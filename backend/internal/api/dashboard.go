package api

import (
	"context"
	"net/http"
	"time"

	"helsa/backend/internal/auth"
	"helsa/backend/internal/reports"
)

// computeUserStreak derives current/longest streaks from the local date of
// every tracked item of ANY kind — food logs, workouts, habit logs (archived
// habits included) and diary entries — in the user's timezone.
func (s *Server) computeUserStreak(ctx context.Context, userID int64, loc *time.Location) (reports.Streak, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT logged_at FROM food_logs WHERE user_id = ?
		 UNION ALL SELECT logged_at FROM workouts WHERE user_id = ?
		 UNION ALL SELECT hl.logged_at FROM habit_logs hl
		   JOIN habits h ON h.id = hl.habit_id WHERE h.user_id = ?`,
		userID, userID, userID)
	if err != nil {
		return reports.Streak{}, err
	}
	defer rows.Close()
	var days []int64
	for rows.Next() {
		var ts int64
		if err := rows.Scan(&ts); err != nil {
			return reports.Streak{}, err
		}
		days = append(days, reports.DayIndex(time.Unix(ts, 0), loc))
	}
	if err := rows.Err(); err != nil {
		return reports.Streak{}, err
	}

	// Diary entries are keyed by local date directly.
	dates, err := s.db.QueryContext(ctx,
		`SELECT date FROM diary_entries WHERE user_id = ?`, userID)
	if err != nil {
		return reports.Streak{}, err
	}
	defer dates.Close()
	for dates.Next() {
		var d string
		if err := dates.Scan(&d); err != nil {
			return reports.Streak{}, err
		}
		if idx, ok := reports.DateIndex(d); ok {
			days = append(days, idx)
		}
	}
	if err := dates.Err(); err != nil {
		return reports.Streak{}, err
	}
	return reports.ComputeStreak(days, reports.DayIndex(s.now(), loc)), nil
}

// habitWithCount pairs a habit with a summed count for one day.
type habitWithCount struct {
	Habit habitJSON `json:"habit"`
	Count int64     `json:"count"`
}

// habitsWithCounts lists the user's non-archived habits (creation order) with
// their summed log count in [fromUnix, toUnix).
func (s *Server) habitsWithCounts(ctx context.Context, userID, fromUnix, toUnix int64) ([]habitWithCount, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT h.id, h.kind, h.name, h.unit, h.direction, h.daily_target, h.archived, h.created_at,
		        COALESCE(SUM(hl.count), 0)
		 FROM habits h
		 LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.logged_at >= ? AND hl.logged_at < ?
		 WHERE h.user_id = ? AND h.archived = 0
		 GROUP BY h.id ORDER BY h.id ASC`,
		fromUnix, toUnix, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]habitWithCount, 0)
	for rows.Next() {
		var h habit
		var count int64
		if err := rows.Scan(&h.ID, &h.Kind, &h.Name, &h.Unit, &h.Direction, &h.DailyTarget, &h.Archived, &h.CreatedAt, &count); err != nil {
			return nil, err
		}
		out = append(out, habitWithCount{Habit: toHabitJSON(h), Count: count})
	}
	return out, rows.Err()
}

// weightSummary is the dashboard "weight" block: latest/earliest entries with
// the profile weight as fallback, plus the profile target.
func (s *Server) weightSummary(ctx context.Context, userID int64) (map[string]any, error) {
	p, _, err := s.loadProfile(ctx, userID)
	if err != nil {
		return nil, err
	}
	current, start := p.WeightKg, p.WeightKg
	latest, earliest, found, err := s.latestAndEarliestWeights(ctx, userID)
	if err != nil {
		return nil, err
	}
	if found {
		current, start = &latest, &earliest
	}
	return map[string]any{
		"current_kg": current,
		"start_kg":   start,
		"target_kg":  p.TargetWeightKg,
	}, nil
}

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	loc := userLocation(u)
	ctx := r.Context()

	plan, err := s.userPlan(ctx, u)
	if err != nil {
		internalError(w, err)
		return
	}

	today, _, err := reports.Bounds("daily", s.now(), loc)
	if err != nil {
		internalError(w, err)
		return
	}
	dayStart, dayEnd := today.Unix(), today.AddDate(0, 0, 1).Unix()

	logs, err := s.queryLogs(ctx, u.ID, dayStart, dayEnd)
	if err != nil {
		internalError(w, err)
		return
	}
	var totals reports.Totals
	logsJSON := make([]foodLogJSON, 0, len(logs))
	for _, l := range logs {
		totals.Calories += l.Calories
		totals.ProteinG += l.ProteinG
		totals.CarbsG += l.CarbsG
		totals.FatG += l.FatG
		logsJSON = append(logsJSON, toFoodLogJSON(l))
	}

	workouts, err := s.queryWorkouts(ctx, u.ID, dayStart, dayEnd)
	if err != nil {
		internalError(w, err)
		return
	}
	var burned float64
	workoutsJSON := make([]workoutJSON, 0, len(workouts))
	for _, x := range workouts {
		burned += x.Calories
		workoutsJSON = append(workoutsJSON, toWorkoutJSON(x))
	}

	// remaining = targets − food totals; null while the plan is incomplete.
	var remaining *reports.Totals
	if plan.Targets != nil {
		remaining = &reports.Totals{
			Calories: plan.Targets.Calories - totals.Calories,
			ProteinG: plan.Targets.ProteinG - totals.ProteinG,
			CarbsG:   plan.Targets.CarbsG - totals.CarbsG,
			FatG:     plan.Targets.FatG - totals.FatG,
		}
	}

	habits, err := s.habitsWithCounts(ctx, u.ID, dayStart, dayEnd)
	if err != nil {
		internalError(w, err)
		return
	}

	var diary any
	if e, found, err := s.loadDiaryEntry(ctx, u.ID, today.Format("2006-01-02")); err != nil {
		internalError(w, err)
		return
	} else if found {
		diary = toDiaryJSON(e)
	}

	weight, err := s.weightSummary(ctx, u.ID)
	if err != nil {
		internalError(w, err)
		return
	}

	streak, err := s.computeUserStreak(ctx, u.ID, loc)
	if err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user": toUserJSON(u),
		"plan": plan,
		"today": map[string]any{
			"date": today.Format("2006-01-02"),
			"food": map[string]any{
				"totals":    totals,
				"log_count": len(logs),
				"logs":      logsJSON,
			},
			"burned_calories": burned,
			"workouts":        workoutsJSON,
			"remaining":       remaining,
			"habits":          habits,
			"diary":           diary,
		},
		"weight": weight,
		"streak": streak,
	})
}
