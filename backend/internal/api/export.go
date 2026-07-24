package api

import (
	"bytes"
	"context"
	"net/http"
	"strconv"

	"helsa/backend/internal/auth"
	"helsa/backend/internal/export"
)

// collectExportData loads all of the user's data oldest-first for the
// workbook.
func (s *Server) collectExportData(ctx context.Context, userID int64) (export.Data, error) {
	var data export.Data

	rows, err := s.db.QueryContext(ctx,
		`SELECT logged_at, food_name, serving, calories, protein_g, carbs_g, fat_g
		 FROM food_logs WHERE user_id = ? ORDER BY logged_at ASC, id ASC`, userID)
	if err != nil {
		return data, err
	}
	defer rows.Close()
	for rows.Next() {
		var r export.FoodLogRow
		if err := rows.Scan(&r.LoggedAt, &r.FoodName, &r.Serving, &r.Calories, &r.ProteinG, &r.CarbsG, &r.FatG); err != nil {
			return data, err
		}
		data.FoodLogs = append(data.FoodLogs, r)
	}
	if err := rows.Err(); err != nil {
		return data, err
	}

	wrows, err := s.db.QueryContext(ctx,
		`SELECT logged_at, activity, duration_min, intensity, calories, calories_estimated, notes
		 FROM workouts WHERE user_id = ? ORDER BY logged_at ASC, id ASC`, userID)
	if err != nil {
		return data, err
	}
	defer wrows.Close()
	for wrows.Next() {
		var r export.WorkoutRow
		if err := wrows.Scan(&r.LoggedAt, &r.Activity, &r.DurationMin, &r.Intensity, &r.Calories, &r.Estimated, &r.Notes); err != nil {
			return data, err
		}
		data.Workouts = append(data.Workouts, r)
	}
	if err := wrows.Err(); err != nil {
		return data, err
	}

	krows, err := s.db.QueryContext(ctx,
		`SELECT measured_at, weight_kg
		 FROM weights WHERE user_id = ? ORDER BY measured_at ASC, id ASC`, userID)
	if err != nil {
		return data, err
	}
	defer krows.Close()
	for krows.Next() {
		var r export.WeightRow
		if err := krows.Scan(&r.MeasuredAt, &r.WeightKg); err != nil {
			return data, err
		}
		data.Weights = append(data.Weights, r)
	}
	if err := krows.Err(); err != nil {
		return data, err
	}

	hrows, err := s.db.QueryContext(ctx,
		`SELECT hl.logged_at, h.name, h.kind, hl.count, h.unit
		 FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id
		 WHERE h.user_id = ? ORDER BY hl.logged_at ASC, hl.id ASC`, userID)
	if err != nil {
		return data, err
	}
	defer hrows.Close()
	for hrows.Next() {
		var r export.HabitLogRow
		if err := hrows.Scan(&r.LoggedAt, &r.HabitName, &r.Kind, &r.Count, &r.Unit); err != nil {
			return data, err
		}
		data.HabitLogs = append(data.HabitLogs, r)
	}
	if err := hrows.Err(); err != nil {
		return data, err
	}

	drows, err := s.db.QueryContext(ctx,
		`SELECT date, mood, energy, text
		 FROM diary_entries WHERE user_id = ? ORDER BY date ASC`, userID)
	if err != nil {
		return data, err
	}
	defer drows.Close()
	for drows.Next() {
		var r export.DiaryRow
		var text *string
		if err := drows.Scan(&r.Date, &r.Mood, &r.Energy, &text); err != nil {
			return data, err
		}
		if text != nil {
			r.Text = *text
		}
		data.Diary = append(data.Diary, r)
	}
	return data, drows.Err()
}

func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	loc := userLocation(u)

	data, err := s.collectExportData(r.Context(), u.ID)
	if err != nil {
		internalError(w, err)
		return
	}

	// Build into memory first so failures can still return a JSON error.
	var buf bytes.Buffer
	if err := export.WriteXLSX(&buf, data, loc); err != nil {
		internalError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="helsa-export.xlsx"`)
	w.Header().Set("Content-Length", strconv.Itoa(buf.Len()))
	w.WriteHeader(http.StatusOK)
	_, _ = buf.WriteTo(w)
}
