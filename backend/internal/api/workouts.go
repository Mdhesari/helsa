package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"helsa/backend/internal/auth"
	"helsa/backend/internal/nutrition"
)

// workout is the internal representation of a workouts row.
type workout struct {
	ID          int64
	Activity    string
	DurationMin int
	Intensity   string
	Calories    float64
	Estimated   bool
	Notes       string
	LoggedAt    int64
	CreatedAt   int64
}

// workoutJSON is the Workout shape from the contract; calories is always set
// (client value or server estimate).
type workoutJSON struct {
	ID                int64   `json:"id"`
	Activity          string  `json:"activity"`
	DurationMin       int     `json:"duration_min"`
	Intensity         string  `json:"intensity"`
	Calories          float64 `json:"calories"`
	CaloriesEstimated bool    `json:"calories_estimated"`
	Notes             string  `json:"notes"`
	LoggedAt          string  `json:"logged_at"`
	CreatedAt         string  `json:"created_at"`
}

func toWorkoutJSON(x workout) workoutJSON {
	return workoutJSON{
		ID:                x.ID,
		Activity:          x.Activity,
		DurationMin:       x.DurationMin,
		Intensity:         x.Intensity,
		Calories:          x.Calories,
		CaloriesEstimated: x.Estimated,
		Notes:             x.Notes,
		LoggedAt:          rfc3339(x.LoggedAt),
		CreatedAt:         rfc3339(x.CreatedAt),
	}
}

// workoutPatch is the POST/PUT body: every field optional so PUT can replace
// only the provided ones. calories is a RawMessage to distinguish "absent"
// (keep the stored value) from an explicit null (re-estimate).
type workoutPatch struct {
	Activity    *string         `json:"activity"`
	DurationMin *int            `json:"duration_min"`
	Intensity   *string         `json:"intensity"`
	Calories    json.RawMessage `json:"calories"`
	Notes       *string         `json:"notes"`
	LoggedAt    *string         `json:"logged_at"`
}

// apply merges the patch into x, validating per the contract. estimate
// reports whether the server must (re-)estimate calories: true when calories
// was omitted on create or explicitly null on update.
func (p workoutPatch) apply(x *workout, create bool) (estimate bool, err error) {
	if p.Activity != nil {
		if _, ok := nutrition.WorkoutMETs[*p.Activity]; !ok {
			return false, errors.New("activity must be one of walking, running, cycling, swimming, strength, yoga, hiit, sports, other")
		}
		x.Activity = *p.Activity
	}
	if p.DurationMin != nil {
		if *p.DurationMin < 1 || *p.DurationMin > 1440 {
			return false, errors.New("duration_min must be an integer between 1 and 1440")
		}
		x.DurationMin = *p.DurationMin
	}
	if p.Intensity != nil {
		if _, ok := nutrition.IntensityMultipliers[*p.Intensity]; !ok {
			return false, errors.New(`intensity must be "low", "moderate" or "high"`)
		}
		x.Intensity = *p.Intensity
	}
	if p.Notes != nil {
		if len(*p.Notes) > 500 {
			return false, errors.New("notes must be at most 500 characters")
		}
		x.Notes = *p.Notes
	}
	if p.LoggedAt != nil {
		t, err := time.Parse(time.RFC3339, *p.LoggedAt)
		if err != nil {
			return false, errors.New("logged_at must be an RFC3339 timestamp")
		}
		x.LoggedAt = t.Unix()
	}
	switch {
	case len(p.Calories) == 0: // absent
		estimate = create
	case string(p.Calories) == "null":
		estimate = true
	default:
		var v float64
		if err := json.Unmarshal(p.Calories, &v); err != nil || v < 0 {
			return false, errors.New("calories must be a number >= 0 or null")
		}
		x.Calories = v
		x.Estimated = false
	}
	return estimate, nil
}

// estimateCalories fills x.Calories with the MET-based server estimate using
// the profile weight (falling back to 70 kg when unset).
func (s *Server) estimateCalories(ctx context.Context, userID int64, x *workout) error {
	p, _, err := s.loadProfile(ctx, userID)
	if err != nil {
		return err
	}
	weight := float64(nutrition.DefaultWorkoutWeightKg)
	if p.WeightKg != nil {
		weight = *p.WeightKg
	}
	cal, ok := nutrition.EstimateWorkoutCalories(x.Activity, x.Intensity, x.DurationMin, weight)
	if !ok {
		return errors.New("cannot estimate calories for this activity/intensity")
	}
	x.Calories = cal
	x.Estimated = true
	return nil
}

func (s *Server) handleCreateWorkout(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var req workoutPatch
	if err := decodeBody(r, &req); err != nil {
		badRequest(w, err.Error())
		return
	}
	now := s.now()
	x := workout{Intensity: "moderate", LoggedAt: now.Unix(), CreatedAt: now.Unix()}
	estimate, err := req.apply(&x, true)
	if err != nil {
		badRequest(w, err.Error())
		return
	}
	if x.Activity == "" {
		badRequest(w, "activity is required")
		return
	}
	if x.DurationMin == 0 {
		badRequest(w, "duration_min is required")
		return
	}
	if estimate {
		if err := s.estimateCalories(r.Context(), u.ID, &x); err != nil {
			internalError(w, err)
			return
		}
	}
	res, err := s.db.ExecContext(r.Context(),
		`INSERT INTO workouts (user_id, activity, duration_min, intensity, calories, calories_estimated, notes, logged_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		u.ID, x.Activity, x.DurationMin, x.Intensity, x.Calories, x.Estimated, x.Notes, x.LoggedAt, x.CreatedAt)
	if err != nil {
		internalError(w, err)
		return
	}
	x.ID, err = res.LastInsertId()
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toWorkoutJSON(x))
}

func (s *Server) handleListWorkouts(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	loc := userLocation(u)
	start, end, ok := s.dayRangeParams(w, r, loc)
	if !ok {
		return
	}
	list, err := s.queryWorkouts(r.Context(), u.ID, start.Unix(), end.AddDate(0, 0, 1).Unix())
	if err != nil {
		internalError(w, err)
		return
	}
	out := make([]workoutJSON, 0, len(list))
	for _, x := range list {
		out = append(out, toWorkoutJSON(x))
	}
	writeJSON(w, http.StatusOK, map[string]any{"workouts": out})
}

// queryWorkouts returns the user's workouts with logged_at in
// [fromUnix, toUnix), ordered by logged_at ascending.
func (s *Server) queryWorkouts(ctx context.Context, userID, fromUnix, toUnix int64) ([]workout, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, activity, duration_min, intensity, calories, calories_estimated, notes, logged_at, created_at
		 FROM workouts WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
		 ORDER BY logged_at ASC, id ASC`, userID, fromUnix, toUnix)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []workout
	for rows.Next() {
		var x workout
		if err := rows.Scan(&x.ID, &x.Activity, &x.DurationMin, &x.Intensity, &x.Calories, &x.Estimated, &x.Notes, &x.LoggedAt, &x.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

func (s *Server) handleUpdateWorkout(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "workout not found")
		return
	}
	var x workout
	err := s.db.QueryRowContext(r.Context(),
		`SELECT id, activity, duration_min, intensity, calories, calories_estimated, notes, logged_at, created_at
		 FROM workouts WHERE id = ? AND user_id = ?`, id, u.ID,
	).Scan(&x.ID, &x.Activity, &x.DurationMin, &x.Intensity, &x.Calories, &x.Estimated, &x.Notes, &x.LoggedAt, &x.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "workout not found")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	var req workoutPatch
	if err := decodeBody(r, &req); err != nil {
		badRequest(w, err.Error())
		return
	}
	estimate, err := req.apply(&x, false)
	if err != nil {
		badRequest(w, err.Error())
		return
	}
	if estimate {
		if err := s.estimateCalories(r.Context(), u.ID, &x); err != nil {
			internalError(w, err)
			return
		}
	}
	if _, err := s.db.ExecContext(r.Context(),
		`UPDATE workouts SET activity = ?, duration_min = ?, intensity = ?, calories = ?, calories_estimated = ?, notes = ?, logged_at = ?
		 WHERE id = ? AND user_id = ?`,
		x.Activity, x.DurationMin, x.Intensity, x.Calories, x.Estimated, x.Notes, x.LoggedAt, x.ID, u.ID); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toWorkoutJSON(x))
}

func (s *Server) handleDeleteWorkout(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "workout not found")
		return
	}
	res, err := s.db.ExecContext(r.Context(),
		`DELETE FROM workouts WHERE id = ? AND user_id = ?`, id, u.ID)
	if err != nil {
		internalError(w, err)
		return
	}
	n, err := res.RowsAffected()
	if err != nil {
		internalError(w, err)
		return
	}
	if n == 0 {
		writeError(w, http.StatusNotFound, "not_found", "workout not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
