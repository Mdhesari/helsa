package api

import (
	"context"
	"log"
	"net/http"
	"time"

	"helsa/backend/internal/auth"
	"helsa/backend/internal/insights"
	"helsa/backend/internal/reports"
)

// parseReportParams validates period and the optional date (default: today
// in the user's timezone). Returns ok=false after writing a 400.
func (s *Server) parseReportParams(w http.ResponseWriter, r *http.Request, loc *time.Location) (period string, ref time.Time, ok bool) {
	period = r.URL.Query().Get("period")
	switch period {
	case "daily", "weekly", "monthly":
	default:
		badRequest(w, "period must be daily, weekly or monthly")
		return "", time.Time{}, false
	}
	ref = s.now()
	if d := r.URL.Query().Get("date"); d != "" {
		parsed, err := time.ParseInLocation("2006-01-02", d, loc)
		if err != nil {
			badRequest(w, "date must be YYYY-MM-DD")
			return "", time.Time{}, false
		}
		ref = parsed
	}
	return period, ref, true
}

// weightSeries returns the last weight entry of each local day in
// [start, end], for days that have entries only, ordered by date.
func (s *Server) weightSeries(ctx context.Context, userID int64, start, end time.Time, loc *time.Location) ([]reports.WeightPoint, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT weight_kg, measured_at FROM weights
		 WHERE user_id = ? AND measured_at >= ? AND measured_at < ?
		 ORDER BY measured_at ASC, id ASC`,
		userID, start.Unix(), end.AddDate(0, 0, 1).Unix())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lastOfDay := make(map[string]float64)
	for rows.Next() {
		var kg float64
		var ts int64
		if err := rows.Scan(&kg, &ts); err != nil {
			return nil, err
		}
		// Ascending order means the last write per day key wins.
		lastOfDay[time.Unix(ts, 0).In(loc).Format("2006-01-02")] = kg
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]reports.WeightPoint, 0, len(lastOfDay))
	for _, day := range reports.DayRange(start, end) {
		if kg, ok := lastOfDay[day]; ok {
			out = append(out, reports.WeightPoint{Date: day, WeightKg: kg})
		}
	}
	return out, nil
}

// habitSeries returns every non-archived habit with a zero-filled per-day
// count series over [start, end].
func (s *Server) habitSeries(ctx context.Context, userID int64, start, end time.Time, loc *time.Location) ([]reports.HabitSeries, error) {
	hrows, err := s.db.QueryContext(ctx,
		`SELECT id, kind, name, unit, direction, daily_target, archived, created_at
		 FROM habits WHERE user_id = ? AND archived = 0 ORDER BY id ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer hrows.Close()
	var habits []habit
	for hrows.Next() {
		var h habit
		if err := hrows.Scan(&h.ID, &h.Kind, &h.Name, &h.Unit, &h.Direction, &h.DailyTarget, &h.Archived, &h.CreatedAt); err != nil {
			return nil, err
		}
		habits = append(habits, h)
	}
	if err := hrows.Err(); err != nil {
		return nil, err
	}

	counts := make(map[int64]map[string]int64) // habit id -> local date -> sum
	lrows, err := s.db.QueryContext(ctx,
		`SELECT hl.habit_id, hl.count, hl.logged_at FROM habit_logs hl
		 JOIN habits h ON h.id = hl.habit_id
		 WHERE h.user_id = ? AND h.archived = 0 AND hl.logged_at >= ? AND hl.logged_at < ?`,
		userID, start.Unix(), end.AddDate(0, 0, 1).Unix())
	if err != nil {
		return nil, err
	}
	defer lrows.Close()
	for lrows.Next() {
		var habitID, count, ts int64
		if err := lrows.Scan(&habitID, &count, &ts); err != nil {
			return nil, err
		}
		day := time.Unix(ts, 0).In(loc).Format("2006-01-02")
		if counts[habitID] == nil {
			counts[habitID] = make(map[string]int64)
		}
		counts[habitID][day] += count
	}
	if err := lrows.Err(); err != nil {
		return nil, err
	}

	days := reports.DayRange(start, end)
	out := make([]reports.HabitSeries, 0, len(habits))
	for _, h := range habits {
		hj := toHabitJSON(h)
		series := make([]reports.CountPoint, 0, len(days))
		for _, day := range days {
			series = append(series, reports.CountPoint{Date: day, Count: counts[h.ID][day]})
		}
		out = append(out, reports.HabitSeries{
			Habit: reports.HabitInfo{
				ID: hj.ID, Kind: hj.Kind, Name: hj.Name, Unit: hj.Unit,
				Direction: hj.Direction, DailyTarget: hj.DailyTarget,
				Archived: hj.Archived, CreatedAt: hj.CreatedAt,
			},
			Series: series,
		})
	}
	return out, nil
}

// buildStats assembles the full report statistics for a period.
func (s *Server) buildStats(ctx context.Context, u auth.User, loc *time.Location, period string, ref time.Time) (reports.Stats, error) {
	start, end, err := reports.Bounds(period, ref, loc)
	if err != nil {
		return reports.Stats{}, err
	}
	fromUnix, toUnix := start.Unix(), end.AddDate(0, 0, 1).Unix()

	rows, err := s.queryLogs(ctx, u.ID, fromUnix, toUnix)
	if err != nil {
		return reports.Stats{}, err
	}
	logRows := make([]reports.LogRow, 0, len(rows))
	for _, l := range rows {
		logRows = append(logRows, reports.LogRow{
			LoggedAt: l.LoggedAt, Calories: l.Calories, ProteinG: l.ProteinG, CarbsG: l.CarbsG, FatG: l.FatG,
		})
	}
	workouts, err := s.queryWorkouts(ctx, u.ID, fromUnix, toUnix)
	if err != nil {
		return reports.Stats{}, err
	}
	workoutRows := make([]reports.WorkoutRow, 0, len(workouts))
	for _, x := range workouts {
		workoutRows = append(workoutRows, reports.WorkoutRow{LoggedAt: x.LoggedAt, Calories: x.Calories})
	}
	buckets := reports.BucketByDay(logRows, workoutRows, start, end, loc)

	plan, err := s.userPlan(ctx, u)
	if err != nil {
		return reports.Stats{}, err
	}
	weights, err := s.weightSeries(ctx, u.ID, start, end, loc)
	if err != nil {
		return reports.Stats{}, err
	}
	habits, err := s.habitSeries(ctx, u.ID, start, end, loc)
	if err != nil {
		return reports.Stats{}, err
	}

	stats := reports.Stats{
		Period:    period,
		StartDate: start.Format("2006-01-02"),
		EndDate:   end.Format("2006-01-02"),
		Timezone:  u.Timezone,
		Plan:      plan,
		Buckets:   buckets,
		Weights:   weights,
		Habits:    habits,
	}
	if avg, ok := reports.Averages(buckets); ok {
		stats.Averages = &avg
		if plan.Targets != nil {
			d := reports.ComputeDeltas(avg, reports.Totals{
				Calories: plan.Targets.Calories, ProteinG: plan.Targets.ProteinG,
				CarbsG: plan.Targets.CarbsG, FatG: plan.Targets.FatG,
			})
			stats.Deltas = &d
		}
	}
	stats.Streak, err = s.computeUserStreak(ctx, u.ID, loc)
	if err != nil {
		return reports.Stats{}, err
	}
	return stats, nil
}

func (s *Server) handleReports(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	loc := userLocation(u)
	period, ref, ok := s.parseReportParams(w, r, loc)
	if !ok {
		return
	}
	stats, err := s.buildStats(r.Context(), u, loc, period, ref)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"period":     stats.Period,
		"start_date": stats.StartDate,
		"end_date":   stats.EndDate,
		"timezone":   stats.Timezone,
		"plan":       stats.Plan,
		"buckets":    stats.Buckets,
		"weights":    stats.Weights,
		"habits":     stats.Habits,
		"averages":   stats.Averages,
		"deltas":     stats.Deltas,
		"streak":     stats.Streak,
	})
}

func (s *Server) handleInsight(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	loc := userLocation(u)
	period, ref, ok := s.parseReportParams(w, r, loc)
	if !ok {
		return
	}
	stats, err := s.buildStats(r.Context(), u, loc, period, ref)
	if err != nil {
		internalError(w, err)
		return
	}
	insight, err := s.provider.GenerateInsight(r.Context(), stats)
	if err != nil {
		// Never a 5xx for provider outages: fall back to the stub.
		log.Printf("insight provider failed, falling back to stub: %v", err)
		insight, err = s.stub.GenerateInsight(r.Context(), stats)
		if err != nil {
			internalError(w, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"text":         insight.Text,
		"generated_by": insight.GeneratedBy,
		"period":       stats.Period,
		"start_date":   stats.StartDate,
		"end_date":     stats.EndDate,
		"disclaimer":   insights.Disclaimer,
	})
}
