package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"helsa/backend/internal/auth"
)

// diaryEntry is the internal representation of a diary_entries row.
type diaryEntry struct {
	Date      string
	Mood      *int64
	Energy    *int64
	Text      *string
	UpdatedAt int64
}

// diaryJSON is the DiaryEntry shape from the contract.
type diaryJSON struct {
	Date      string  `json:"date"`
	Mood      *int64  `json:"mood"`
	Energy    *int64  `json:"energy"`
	Text      *string `json:"text"`
	UpdatedAt string  `json:"updated_at"`
}

func toDiaryJSON(e diaryEntry) diaryJSON {
	return diaryJSON{
		Date:      e.Date,
		Mood:      e.Mood,
		Energy:    e.Energy,
		Text:      e.Text,
		UpdatedAt: rfc3339(e.UpdatedAt),
	}
}

// diaryDate validates a YYYY-MM-DD path or query value.
func diaryDate(v string) (string, error) {
	t, err := time.Parse("2006-01-02", v)
	if err != nil || t.Format("2006-01-02") != v {
		return "", errors.New("date must be YYYY-MM-DD")
	}
	return v, nil
}

// loadDiaryEntry returns the user's entry for a local date; found is false
// when none exists.
func (s *Server) loadDiaryEntry(ctx context.Context, userID int64, date string) (diaryEntry, bool, error) {
	e := diaryEntry{Date: date}
	err := s.db.QueryRowContext(ctx,
		`SELECT mood, energy, text, updated_at FROM diary_entries WHERE user_id = ? AND date = ?`,
		userID, date).Scan(&e.Mood, &e.Energy, &e.Text, &e.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return diaryEntry{}, false, nil
	}
	if err != nil {
		return diaryEntry{}, false, err
	}
	return e, true, nil
}

func (s *Server) handleGetDiary(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	q := r.URL.Query()

	// Range form: both bounds required, ordered by date asc.
	if q.Get("from") != "" || q.Get("to") != "" {
		if q.Get("from") == "" || q.Get("to") == "" {
			badRequest(w, "both from and to are required for a range")
			return
		}
		from, err1 := diaryDate(q.Get("from"))
		to, err2 := diaryDate(q.Get("to"))
		if err1 != nil || err2 != nil {
			badRequest(w, "from and to must be YYYY-MM-DD")
			return
		}
		if to < from {
			badRequest(w, "to must not be before from")
			return
		}
		rows, err := s.db.QueryContext(r.Context(),
			`SELECT date, mood, energy, text, updated_at FROM diary_entries
			 WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC`,
			u.ID, from, to)
		if err != nil {
			internalError(w, err)
			return
		}
		defer rows.Close()
		out := make([]diaryJSON, 0)
		for rows.Next() {
			var e diaryEntry
			if err := rows.Scan(&e.Date, &e.Mood, &e.Energy, &e.Text, &e.UpdatedAt); err != nil {
				internalError(w, err)
				return
			}
			out = append(out, toDiaryJSON(e))
		}
		if err := rows.Err(); err != nil {
			internalError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"entries": out})
		return
	}

	// Single-date form; default today in the user's timezone.
	date := s.now().In(userLocation(u)).Format("2006-01-02")
	if v := q.Get("date"); v != "" {
		var err error
		if date, err = diaryDate(v); err != nil {
			badRequest(w, err.Error())
			return
		}
	}
	e, found, err := s.loadDiaryEntry(r.Context(), u.ID, date)
	if err != nil {
		internalError(w, err)
		return
	}
	if !found {
		writeJSON(w, http.StatusOK, map[string]any{"entry": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entry": toDiaryJSON(e)})
}

func (s *Server) handlePutDiary(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	date, err := diaryDate(r.PathValue("date"))
	if err != nil {
		badRequest(w, err.Error())
		return
	}
	var fields map[string]json.RawMessage
	if err := decodeBody(r, &fields); err != nil {
		badRequest(w, err.Error())
		return
	}
	if len(fields) == 0 {
		badRequest(w, "at least one of mood, energy or text is required")
		return
	}

	e, _, err := s.loadDiaryEntry(r.Context(), u.ID, date)
	if err != nil {
		internalError(w, err)
		return
	}
	e.Date = date
	for key, raw := range fields {
		isNull := string(raw) == "null"
		switch key {
		case "mood", "energy":
			dst := &e.Mood
			if key == "energy" {
				dst = &e.Energy
			}
			if isNull {
				*dst = nil
				continue
			}
			var v int64
			if err := json.Unmarshal(raw, &v); err != nil || v < 1 || v > 5 {
				badRequest(w, key+" must be an integer between 1 and 5")
				return
			}
			*dst = &v
		case "text":
			if isNull {
				e.Text = nil
				continue
			}
			var v string
			if err := json.Unmarshal(raw, &v); err != nil {
				badRequest(w, "text must be a string or null")
				return
			}
			if len(v) > 2000 {
				badRequest(w, "text must be at most 2000 characters")
				return
			}
			if v == "" { // empty string means null per the contract
				e.Text = nil
				continue
			}
			e.Text = &v
		default:
			badRequest(w, fmt.Sprintf("unknown field %q", key))
			return
		}
	}

	// All content fields null: the row is deleted instead of stored.
	if e.Mood == nil && e.Energy == nil && e.Text == nil {
		if _, err := s.db.ExecContext(r.Context(),
			`DELETE FROM diary_entries WHERE user_id = ? AND date = ?`, u.ID, date); err != nil {
			internalError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}

	e.UpdatedAt = s.now().Unix()
	if _, err := s.db.ExecContext(r.Context(),
		`INSERT INTO diary_entries (user_id, date, mood, energy, text, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(user_id, date) DO UPDATE SET
		   mood = excluded.mood, energy = excluded.energy, text = excluded.text,
		   updated_at = excluded.updated_at`,
		u.ID, e.Date, e.Mood, e.Energy, e.Text, e.UpdatedAt); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toDiaryJSON(e))
}

func (s *Server) handleDeleteDiary(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	date, err := diaryDate(r.PathValue("date"))
	if err != nil {
		badRequest(w, err.Error())
		return
	}
	// Idempotent: deleting a missing entry is still a 204.
	if _, err := s.db.ExecContext(r.Context(),
		`DELETE FROM diary_entries WHERE user_id = ? AND date = ?`, u.ID, date); err != nil {
		internalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
