package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"helsa/backend/internal/auth"
)

// foodLog is the internal representation of a food_logs row.
type foodLog struct {
	ID        int64
	FoodName  string
	Serving   string
	Calories  float64
	ProteinG  float64
	CarbsG    float64
	FatG      float64
	LoggedAt  int64
	CreatedAt int64
	FoodRefID sql.NullInt64 // provenance only; nutrients stay denormalized
}

// foodLogJSON is the FoodLog shape from the contract.
type foodLogJSON struct {
	ID        int64   `json:"id"`
	FoodName  string  `json:"food_name"`
	Serving   string  `json:"serving"`
	Calories  float64 `json:"calories"`
	ProteinG  float64 `json:"protein_g"`
	CarbsG    float64 `json:"carbs_g"`
	FatG      float64 `json:"fat_g"`
	LoggedAt  string  `json:"logged_at"`
	CreatedAt string  `json:"created_at"`
	FoodRefID *int64  `json:"food_ref_id"`
}

func toFoodLogJSON(l foodLog) foodLogJSON {
	out := foodLogJSON{
		ID:        l.ID,
		FoodName:  l.FoodName,
		Serving:   l.Serving,
		Calories:  l.Calories,
		ProteinG:  l.ProteinG,
		CarbsG:    l.CarbsG,
		FatG:      l.FatG,
		LoggedAt:  rfc3339(l.LoggedAt),
		CreatedAt: rfc3339(l.CreatedAt),
	}
	if l.FoodRefID.Valid {
		out.FoodRefID = &l.FoodRefID.Int64
	}
	return out
}

// logPatch is the POST/PUT body: every field optional so PUT can replace
// only the provided ones. food_ref_id is a RawMessage to distinguish
// "absent" (no change) from an explicit null (clear the reference).
type logPatch struct {
	FoodName  *string         `json:"food_name"`
	Serving   *string         `json:"serving"`
	Calories  *float64        `json:"calories"`
	ProteinG  *float64        `json:"protein_g"`
	CarbsG    *float64        `json:"carbs_g"`
	FatG      *float64        `json:"fat_g"`
	LoggedAt  *string         `json:"logged_at"`
	FoodRefID json.RawMessage `json:"food_ref_id"`
}

// apply merges the patch into l, validating per the contract. Returns a
// human-readable validation error.
func (p logPatch) apply(l *foodLog) error {
	if p.FoodName != nil {
		if strings.TrimSpace(*p.FoodName) == "" {
			return errors.New("food_name must be non-empty")
		}
		l.FoodName = *p.FoodName
	}
	if p.Serving != nil {
		l.Serving = *p.Serving
	}
	for _, f := range []struct {
		name string
		src  *float64
		dst  *float64
	}{
		{"calories", p.Calories, &l.Calories},
		{"protein_g", p.ProteinG, &l.ProteinG},
		{"carbs_g", p.CarbsG, &l.CarbsG},
		{"fat_g", p.FatG, &l.FatG},
	} {
		if f.src == nil {
			continue
		}
		if *f.src < 0 {
			return errors.New(f.name + " must be >= 0")
		}
		*f.dst = *f.src
	}
	if p.LoggedAt != nil {
		t, err := time.Parse(time.RFC3339, *p.LoggedAt)
		if err != nil {
			return errors.New("logged_at must be an RFC3339 timestamp")
		}
		l.LoggedAt = t.Unix()
	}
	if len(p.FoodRefID) > 0 {
		if string(p.FoodRefID) == "null" {
			l.FoodRefID = sql.NullInt64{}
		} else {
			var id int64
			if err := json.Unmarshal(p.FoodRefID, &id); err != nil || id < 1 {
				return errors.New("food_ref_id must be a positive integer or null")
			}
			l.FoodRefID = sql.NullInt64{Int64: id, Valid: true}
		}
	}
	return nil
}

// validateFoodRef 400s when the patch sets a food_ref_id the caller cannot
// see; returns false when the response was already written.
func (s *Server) validateFoodRef(w http.ResponseWriter, r *http.Request, userID int64, l foodLog) bool {
	if !l.FoodRefID.Valid {
		return true
	}
	visible, err := s.visibleFoodExists(r.Context(), userID, l.FoodRefID.Int64)
	if err != nil {
		internalError(w, err)
		return false
	}
	if !visible {
		badRequest(w, "food_ref_id does not reference a visible food")
		return false
	}
	return true
}

func (s *Server) handleCreateLog(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var req logPatch
	if err := decodeBody(r, &req); err != nil {
		badRequest(w, err.Error())
		return
	}
	now := s.now()
	l := foodLog{LoggedAt: now.Unix(), CreatedAt: now.Unix()}
	if err := req.apply(&l); err != nil {
		badRequest(w, err.Error())
		return
	}
	if l.FoodName == "" {
		badRequest(w, "food_name is required")
		return
	}
	if !s.validateFoodRef(w, r, u.ID, l) {
		return
	}
	res, err := s.db.ExecContext(r.Context(),
		`INSERT INTO food_logs (user_id, food_name, serving, calories, protein_g, carbs_g, fat_g, logged_at, created_at, food_ref_id)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		u.ID, l.FoodName, l.Serving, l.Calories, l.ProteinG, l.CarbsG, l.FatG, l.LoggedAt, l.CreatedAt, l.FoodRefID)
	if err != nil {
		internalError(w, err)
		return
	}
	l.ID, err = res.LastInsertId()
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toFoodLogJSON(l))
}

func (s *Server) handleListLogs(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	loc := userLocation(u)
	startDay, endDay, ok := s.dayRangeParams(w, r, loc)
	if !ok {
		return
	}
	logs, err := s.queryLogs(r.Context(), u.ID, startDay.Unix(), endDay.AddDate(0, 0, 1).Unix())
	if err != nil {
		internalError(w, err)
		return
	}
	out := make([]foodLogJSON, 0, len(logs))
	for _, l := range logs {
		out = append(out, toFoodLogJSON(l))
	}
	writeJSON(w, http.StatusOK, map[string]any{"logs": out})
}

// queryLogs returns the user's logs with logged_at in [fromUnix, toUnix),
// ordered by logged_at ascending.
func (s *Server) queryLogs(ctx context.Context, userID, fromUnix, toUnix int64) ([]foodLog, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, food_name, serving, calories, protein_g, carbs_g, fat_g, logged_at, created_at, food_ref_id
		 FROM food_logs WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
		 ORDER BY logged_at ASC, id ASC`, userID, fromUnix, toUnix)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []foodLog
	for rows.Next() {
		var l foodLog
		if err := rows.Scan(&l.ID, &l.FoodName, &l.Serving, &l.Calories, &l.ProteinG, &l.CarbsG, &l.FatG, &l.LoggedAt, &l.CreatedAt, &l.FoodRefID); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// getOwnedLog loads a log by id scoped to the owner; sql.ErrNoRows when the
// log does not exist or belongs to someone else.
func (s *Server) getOwnedLog(ctx context.Context, userID, logID int64) (foodLog, error) {
	var l foodLog
	err := s.db.QueryRowContext(ctx,
		`SELECT id, food_name, serving, calories, protein_g, carbs_g, fat_g, logged_at, created_at, food_ref_id
		 FROM food_logs WHERE id = ? AND user_id = ?`, logID, userID,
	).Scan(&l.ID, &l.FoodName, &l.Serving, &l.Calories, &l.ProteinG, &l.CarbsG, &l.FatG, &l.LoggedAt, &l.CreatedAt, &l.FoodRefID)
	return l, err
}

func pathID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id, err == nil && id > 0
}

func (s *Server) handleUpdateLog(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "log not found")
		return
	}
	l, err := s.getOwnedLog(r.Context(), u.ID, id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "log not found")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	var req logPatch
	if err := decodeBody(r, &req); err != nil {
		badRequest(w, err.Error())
		return
	}
	if err := req.apply(&l); err != nil {
		badRequest(w, err.Error())
		return
	}
	if !s.validateFoodRef(w, r, u.ID, l) {
		return
	}
	if _, err := s.db.ExecContext(r.Context(),
		`UPDATE food_logs SET food_name = ?, serving = ?, calories = ?, protein_g = ?, carbs_g = ?, fat_g = ?, logged_at = ?, food_ref_id = ?
		 WHERE id = ? AND user_id = ?`,
		l.FoodName, l.Serving, l.Calories, l.ProteinG, l.CarbsG, l.FatG, l.LoggedAt, l.FoodRefID, l.ID, u.ID); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toFoodLogJSON(l))
}

func (s *Server) handleDeleteLog(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "log not found")
		return
	}
	res, err := s.db.ExecContext(r.Context(),
		`DELETE FROM food_logs WHERE id = ? AND user_id = ?`, id, u.ID)
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
		writeError(w, http.StatusNotFound, "not_found", "log not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
