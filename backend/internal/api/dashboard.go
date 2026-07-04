package api

import (
	"context"
	"net/http"
	"time"

	"helsa/backend/internal/auth"
	"helsa/backend/internal/nutrition"
	"helsa/backend/internal/reports"
)

// userTargets loads the profile and computes daily targets; targets is nil
// unless all five biometrics are set (profileComplete).
func (s *Server) userTargets(ctx context.Context, userID int64) (targets *reports.Totals, profileComplete bool, err error) {
	p, _, err := s.loadProfile(ctx, userID)
	if err != nil {
		return nil, false, err
	}
	t, ok := nutrition.Compute(p)
	if !ok {
		return nil, false, nil
	}
	return &reports.Totals{Calories: t.Calories, ProteinG: t.ProteinG, CarbsG: t.CarbsG, FatG: t.FatG}, true, nil
}

// computeUserStreak derives current/longest streaks from every log's local
// date in the user's timezone.
func (s *Server) computeUserStreak(ctx context.Context, userID int64, loc *time.Location) (reports.Streak, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT logged_at FROM food_logs WHERE user_id = ?`, userID)
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
	return reports.ComputeStreak(days, reports.DayIndex(s.now(), loc)), nil
}

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	loc := userLocation(u)
	ctx := r.Context()

	targets, profileComplete, err := s.userTargets(ctx, u.ID)
	if err != nil {
		internalError(w, err)
		return
	}

	today, _, err := reports.Bounds("daily", s.now(), loc)
	if err != nil {
		internalError(w, err)
		return
	}
	logs, err := s.queryLogs(ctx, u.ID, today.Unix(), today.AddDate(0, 0, 1).Unix())
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

	streak, err := s.computeUserStreak(ctx, u.ID, loc)
	if err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user":             toUserJSON(u),
		"profile_complete": profileComplete,
		"targets":          targets,
		"today": map[string]any{
			"date":      today.Format("2006-01-02"),
			"totals":    totals,
			"log_count": len(logs),
			"logs":      logsJSON,
		},
		"streak": streak,
	})
}
