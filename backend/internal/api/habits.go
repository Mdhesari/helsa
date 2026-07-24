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

// habit is the internal representation of a habits row.
type habit struct {
	ID          int64
	Kind        string
	Name        string
	Unit        string
	Direction   string
	DailyTarget sql.NullInt64
	Archived    bool
	CreatedAt   int64
}

// habitJSON is the Habit shape from the contract.
type habitJSON struct {
	ID          int64  `json:"id"`
	Kind        string `json:"kind"`
	Name        string `json:"name"`
	Unit        string `json:"unit"`
	Direction   string `json:"direction"`
	DailyTarget *int64 `json:"daily_target"`
	Archived    bool   `json:"archived"`
	CreatedAt   string `json:"created_at"`
}

func toHabitJSON(h habit) habitJSON {
	out := habitJSON{
		ID:        h.ID,
		Kind:      h.Kind,
		Name:      h.Name,
		Unit:      h.Unit,
		Direction: h.Direction,
		Archived:  h.Archived,
		CreatedAt: rfc3339(h.CreatedAt),
	}
	if h.DailyTarget.Valid {
		out.DailyTarget = &h.DailyTarget.Int64
	}
	return out
}

// habitLogJSON is the HabitLog shape from the contract.
type habitLogJSON struct {
	ID        int64  `json:"id"`
	HabitID   int64  `json:"habit_id"`
	Count     int64  `json:"count"`
	LoggedAt  string `json:"logged_at"`
	CreatedAt string `json:"created_at"`
}

// habitPreset holds the creation defaults for a habit kind.
type habitPreset struct {
	Name      string
	Unit      string
	Direction string
	Target    sql.NullInt64
}

// habitPresets are the per-kind creation defaults from the contract. The
// custom kind has no default name — it is required in the request.
var habitPresets = map[string]habitPreset{
	"cigarette": {Name: "Cigarettes", Unit: "cigarettes", Direction: "reduce"},
	"water":     {Name: "Water", Unit: "glasses", Direction: "build", Target: sql.NullInt64{Int64: 8, Valid: true}},
	"coffee":    {Name: "Coffee", Unit: "cups", Direction: "reduce"},
	"alcohol":   {Name: "Alcohol", Unit: "drinks", Direction: "reduce"},
	"custom":    {Unit: "times", Direction: "build"},
}

func (s *Server) handleListHabits(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	includeArchived := r.URL.Query().Get("include_archived") == "true"
	q := `SELECT id, kind, name, unit, direction, daily_target, archived, created_at
	      FROM habits WHERE user_id = ?`
	if !includeArchived {
		q += ` AND archived = 0`
	}
	q += ` ORDER BY id ASC` // creation order
	rows, err := s.db.QueryContext(r.Context(), q, u.ID)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()
	out := make([]habitJSON, 0)
	for rows.Next() {
		var h habit
		if err := rows.Scan(&h.ID, &h.Kind, &h.Name, &h.Unit, &h.Direction, &h.DailyTarget, &h.Archived, &h.CreatedAt); err != nil {
			internalError(w, err)
			return
		}
		out = append(out, toHabitJSON(h))
	}
	if err := rows.Err(); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"habits": out})
}

func (s *Server) handleCreateHabit(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var req struct {
		Kind        string          `json:"kind"`
		Name        *string         `json:"name"`
		Unit        *string         `json:"unit"`
		Direction   *string         `json:"direction"`
		DailyTarget json.RawMessage `json:"daily_target"`
	}
	if err := decodeBody(r, &req); err != nil {
		badRequest(w, err.Error())
		return
	}
	preset, ok := habitPresets[req.Kind]
	if !ok {
		badRequest(w, "kind must be one of cigarette, water, coffee, alcohol, custom")
		return
	}
	h := habit{
		Kind: req.Kind, Name: preset.Name, Unit: preset.Unit,
		Direction: preset.Direction, DailyTarget: preset.Target,
		CreatedAt: s.now().Unix(),
	}
	if req.Name != nil {
		h.Name = strings.TrimSpace(*req.Name)
	}
	if h.Name == "" {
		badRequest(w, "name is required for custom habits")
		return
	}
	if req.Unit != nil {
		if strings.TrimSpace(*req.Unit) == "" {
			badRequest(w, "unit must be non-empty")
			return
		}
		h.Unit = *req.Unit
	}
	if req.Direction != nil {
		if *req.Direction != "reduce" && *req.Direction != "build" {
			badRequest(w, `direction must be "reduce" or "build"`)
			return
		}
		h.Direction = *req.Direction
	}
	if len(req.DailyTarget) > 0 {
		if string(req.DailyTarget) == "null" {
			h.DailyTarget = sql.NullInt64{}
		} else {
			var v int64
			if err := json.Unmarshal(req.DailyTarget, &v); err != nil || v < 1 {
				badRequest(w, "daily_target must be a positive integer or null")
				return
			}
			h.DailyTarget = sql.NullInt64{Int64: v, Valid: true}
		}
	}
	res, err := s.db.ExecContext(r.Context(),
		`INSERT INTO habits (user_id, kind, name, unit, direction, daily_target, archived, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
		u.ID, h.Kind, h.Name, h.Unit, h.Direction, h.DailyTarget, h.CreatedAt)
	if err != nil {
		internalError(w, err)
		return
	}
	h.ID, err = res.LastInsertId()
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toHabitJSON(h))
}

// getOwnedHabit loads a habit scoped to the owner; sql.ErrNoRows when it
// does not exist or belongs to someone else. Archived habits are returned.
func (s *Server) getOwnedHabit(ctx context.Context, userID, habitID int64) (habit, error) {
	var h habit
	err := s.db.QueryRowContext(ctx,
		`SELECT id, kind, name, unit, direction, daily_target, archived, created_at
		 FROM habits WHERE id = ? AND user_id = ?`, habitID, userID,
	).Scan(&h.ID, &h.Kind, &h.Name, &h.Unit, &h.Direction, &h.DailyTarget, &h.Archived, &h.CreatedAt)
	return h, err
}

func (s *Server) handleUpdateHabit(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "habit not found")
		return
	}
	h, err := s.getOwnedHabit(r.Context(), u.ID, id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "habit not found")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	var req struct {
		Name        *string         `json:"name"`
		Unit        *string         `json:"unit"`
		Direction   *string         `json:"direction"`
		DailyTarget json.RawMessage `json:"daily_target"`
		Archived    *bool           `json:"archived"`
	}
	if err := decodeBody(r, &req); err != nil {
		badRequest(w, err.Error())
		return
	}
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			badRequest(w, "name must be non-empty")
			return
		}
		h.Name = name
	}
	if req.Unit != nil {
		if strings.TrimSpace(*req.Unit) == "" {
			badRequest(w, "unit must be non-empty")
			return
		}
		h.Unit = *req.Unit
	}
	if req.Direction != nil {
		if *req.Direction != "reduce" && *req.Direction != "build" {
			badRequest(w, `direction must be "reduce" or "build"`)
			return
		}
		h.Direction = *req.Direction
	}
	if len(req.DailyTarget) > 0 {
		if string(req.DailyTarget) == "null" {
			h.DailyTarget = sql.NullInt64{}
		} else {
			var v int64
			if err := json.Unmarshal(req.DailyTarget, &v); err != nil || v < 1 {
				badRequest(w, "daily_target must be a positive integer or null")
				return
			}
			h.DailyTarget = sql.NullInt64{Int64: v, Valid: true}
		}
	}
	if req.Archived != nil {
		h.Archived = *req.Archived
	}
	if _, err := s.db.ExecContext(r.Context(),
		`UPDATE habits SET name = ?, unit = ?, direction = ?, daily_target = ?, archived = ?
		 WHERE id = ? AND user_id = ?`,
		h.Name, h.Unit, h.Direction, h.DailyTarget, h.Archived, h.ID, u.ID); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toHabitJSON(h))
}

func (s *Server) handleDeleteHabit(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "habit not found")
		return
	}
	// Soft delete: archive, keep logs. Idempotent for already-archived habits.
	res, err := s.db.ExecContext(r.Context(),
		`UPDATE habits SET archived = 1 WHERE id = ? AND user_id = ?`, id, u.ID)
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
		writeError(w, http.StatusNotFound, "not_found", "habit not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleCreateHabitLog(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "habit not found")
		return
	}
	// Archived habits still accept logs; only ownership matters.
	if _, err := s.getOwnedHabit(r.Context(), u.ID, id); errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "habit not found")
		return
	} else if err != nil {
		internalError(w, err)
		return
	}
	var req struct {
		Count    *int64  `json:"count"`
		LoggedAt *string `json:"logged_at"`
	}
	if err := decodeBody(r, &req); err != nil {
		badRequest(w, err.Error())
		return
	}
	count := int64(1)
	if req.Count != nil {
		if *req.Count < 1 || *req.Count > 100 {
			badRequest(w, "count must be an integer between 1 and 100")
			return
		}
		count = *req.Count
	}
	now := s.now()
	loggedAt := now.Unix()
	if req.LoggedAt != nil {
		t, err := time.Parse(time.RFC3339, *req.LoggedAt)
		if err != nil {
			badRequest(w, "logged_at must be an RFC3339 timestamp")
			return
		}
		loggedAt = t.Unix()
	}
	res, err := s.db.ExecContext(r.Context(),
		`INSERT INTO habit_logs (habit_id, count, logged_at, created_at) VALUES (?, ?, ?, ?)`,
		id, count, loggedAt, now.Unix())
	if err != nil {
		internalError(w, err)
		return
	}
	logID, err := res.LastInsertId()
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, habitLogJSON{
		ID: logID, HabitID: id, Count: count,
		LoggedAt: rfc3339(loggedAt), CreatedAt: rfc3339(now.Unix()),
	})
}

func (s *Server) handleListHabitLogs(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "habit not found")
		return
	}
	if _, err := s.getOwnedHabit(r.Context(), u.ID, id); errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "habit not found")
		return
	} else if err != nil {
		internalError(w, err)
		return
	}
	loc := userLocation(u)
	start, end, ok := s.fromToParams(w, r, loc, 30)
	if !ok {
		return
	}
	rows, err := s.db.QueryContext(r.Context(),
		`SELECT id, count, logged_at, created_at
		 FROM habit_logs WHERE habit_id = ? AND logged_at >= ? AND logged_at < ?
		 ORDER BY logged_at ASC, id ASC`,
		id, start.Unix(), end.AddDate(0, 0, 1).Unix())
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()
	out := make([]habitLogJSON, 0)
	for rows.Next() {
		var logID, count, loggedAt, createdAt int64
		if err := rows.Scan(&logID, &count, &loggedAt, &createdAt); err != nil {
			internalError(w, err)
			return
		}
		out = append(out, habitLogJSON{
			ID: logID, HabitID: id, Count: count,
			LoggedAt: rfc3339(loggedAt), CreatedAt: rfc3339(createdAt),
		})
	}
	if err := rows.Err(); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"logs": out})
}

func (s *Server) handleDeleteHabitLog(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, ok := pathID(r)
	logID, err := strconv.ParseInt(r.PathValue("logId"), 10, 64)
	if !ok || err != nil || logID < 1 {
		writeError(w, http.StatusNotFound, "not_found", "habit log not found")
		return
	}
	res, err := s.db.ExecContext(r.Context(),
		`DELETE FROM habit_logs WHERE id = ? AND habit_id IN
		   (SELECT id FROM habits WHERE id = ? AND user_id = ?)`,
		logID, id, u.ID)
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
		writeError(w, http.StatusNotFound, "not_found", "habit log not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
