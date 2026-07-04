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

// buildStats assembles the full report statistics for a period.
func (s *Server) buildStats(ctx context.Context, u auth.User, loc *time.Location, period string, ref time.Time) (reports.Stats, error) {
	start, end, err := reports.Bounds(period, ref, loc)
	if err != nil {
		return reports.Stats{}, err
	}
	rows, err := s.queryLogs(ctx, u.ID, start.Unix(), end.AddDate(0, 0, 1).Unix())
	if err != nil {
		return reports.Stats{}, err
	}
	logRows := make([]reports.LogRow, 0, len(rows))
	for _, l := range rows {
		logRows = append(logRows, reports.LogRow{
			LoggedAt: l.LoggedAt, Calories: l.Calories, ProteinG: l.ProteinG, CarbsG: l.CarbsG, FatG: l.FatG,
		})
	}
	buckets := reports.BucketByDay(logRows, start, end, loc)

	targets, profileComplete, err := s.userTargets(ctx, u.ID)
	if err != nil {
		return reports.Stats{}, err
	}
	stats := reports.Stats{
		Period:          period,
		StartDate:       start.Format("2006-01-02"),
		EndDate:         end.Format("2006-01-02"),
		Timezone:        u.Timezone,
		ProfileComplete: profileComplete,
		Targets:         targets,
		Buckets:         buckets,
	}
	if avg, ok := reports.Averages(buckets); ok {
		stats.Averages = &avg
		if targets != nil {
			d := reports.ComputeDeltas(avg, *targets)
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
		"period":           stats.Period,
		"start_date":       stats.StartDate,
		"end_date":         stats.EndDate,
		"timezone":         stats.Timezone,
		"profile_complete": stats.ProfileComplete,
		"targets":          stats.Targets,
		"buckets":          stats.Buckets,
		"averages":         stats.Averages,
		"deltas":           stats.Deltas,
		"streak":           stats.Streak,
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
