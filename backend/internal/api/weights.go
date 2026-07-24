package api

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"time"

	"helsa/backend/internal/auth"
)

// weightEntry is the internal representation of a weights row.
type weightEntry struct {
	ID         int64
	WeightKg   float64
	MeasuredAt int64
	CreatedAt  int64
}

// weightJSON is the WeightEntry shape from the contract.
type weightJSON struct {
	ID         int64   `json:"id"`
	WeightKg   float64 `json:"weight_kg"`
	MeasuredAt string  `json:"measured_at"`
	CreatedAt  string  `json:"created_at"`
}

func toWeightJSON(e weightEntry) weightJSON {
	return weightJSON{
		ID:         e.ID,
		WeightKg:   e.WeightKg,
		MeasuredAt: rfc3339(e.MeasuredAt),
		CreatedAt:  rfc3339(e.CreatedAt),
	}
}

func (s *Server) handleCreateWeight(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var req struct {
		WeightKg   *float64 `json:"weight_kg"`
		MeasuredAt *string  `json:"measured_at"`
	}
	if err := decodeBody(r, &req); err != nil {
		badRequest(w, err.Error())
		return
	}
	if req.WeightKg == nil || *req.WeightKg < 20 || *req.WeightKg > 400 {
		badRequest(w, "weight_kg must be a number between 20 and 400")
		return
	}
	now := s.now()
	e := weightEntry{WeightKg: *req.WeightKg, MeasuredAt: now.Unix(), CreatedAt: now.Unix()}
	if req.MeasuredAt != nil {
		t, err := time.Parse(time.RFC3339, *req.MeasuredAt)
		if err != nil {
			badRequest(w, "measured_at must be an RFC3339 timestamp")
			return
		}
		e.MeasuredAt = t.Unix()
	}
	res, err := s.db.ExecContext(r.Context(),
		`INSERT INTO weights (user_id, weight_kg, measured_at, created_at) VALUES (?, ?, ?, ?)`,
		u.ID, e.WeightKg, e.MeasuredAt, e.CreatedAt)
	if err != nil {
		internalError(w, err)
		return
	}
	e.ID, err = res.LastInsertId()
	if err != nil {
		internalError(w, err)
		return
	}
	// Side effect: when this entry is the user's newest by measured_at, the
	// profile's current weight follows it. Ties resolve to the latest insert.
	if err := s.syncProfileWeight(r.Context(), u.ID, e); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toWeightJSON(e))
}

// syncProfileWeight sets profiles.weight_kg to e.WeightKg when e is the
// user's newest entry, creating the profile row if it does not exist.
func (s *Server) syncProfileWeight(ctx context.Context, userID int64, e weightEntry) error {
	var newestID int64
	err := s.db.QueryRowContext(ctx,
		`SELECT id FROM weights WHERE user_id = ? ORDER BY measured_at DESC, id DESC LIMIT 1`,
		userID).Scan(&newestID)
	if err != nil {
		return err
	}
	if newestID != e.ID {
		return nil
	}
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO profiles (user_id, weight_kg, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(user_id) DO UPDATE SET weight_kg = excluded.weight_kg, updated_at = excluded.updated_at`,
		userID, e.WeightKg, s.now().Unix())
	return err
}

func (s *Server) handleListWeights(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	loc := userLocation(u)
	start, end, ok := s.fromToParams(w, r, loc, 90)
	if !ok {
		return
	}
	rows, err := s.db.QueryContext(r.Context(),
		`SELECT id, weight_kg, measured_at, created_at
		 FROM weights WHERE user_id = ? AND measured_at >= ? AND measured_at < ?
		 ORDER BY measured_at ASC, id ASC`,
		u.ID, start.Unix(), end.AddDate(0, 0, 1).Unix())
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()
	out := make([]weightJSON, 0)
	for rows.Next() {
		var e weightEntry
		if err := rows.Scan(&e.ID, &e.WeightKg, &e.MeasuredAt, &e.CreatedAt); err != nil {
			internalError(w, err)
			return
		}
		out = append(out, toWeightJSON(e))
	}
	if err := rows.Err(); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": out})
}

func (s *Server) handleDeleteWeight(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "weight entry not found")
		return
	}
	// No profile rollback on delete, per the contract.
	res, err := s.db.ExecContext(r.Context(),
		`DELETE FROM weights WHERE id = ? AND user_id = ?`, id, u.ID)
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
		writeError(w, http.StatusNotFound, "not_found", "weight entry not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// latestAndEarliestWeights returns the user's newest and oldest weight
// entries; found is false when the user has none.
func (s *Server) latestAndEarliestWeights(ctx context.Context, userID int64) (latest, earliest float64, found bool, err error) {
	err = s.db.QueryRowContext(ctx,
		`SELECT w1.weight_kg, w2.weight_kg
		 FROM (SELECT weight_kg FROM weights WHERE user_id = ? ORDER BY measured_at DESC, id DESC LIMIT 1) w1,
		      (SELECT weight_kg FROM weights WHERE user_id = ? ORDER BY measured_at ASC, id ASC LIMIT 1) w2`,
		userID, userID).Scan(&latest, &earliest)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, 0, false, nil
	}
	if err != nil {
		return 0, 0, false, err
	}
	return latest, earliest, true, nil
}
