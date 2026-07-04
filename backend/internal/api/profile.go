package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"helsa/backend/internal/auth"
	"helsa/backend/internal/nutrition"
)

// profileJSON is the Profile shape from the contract; every biometric field
// is nullable. updated_at is null when the profile has never been set.
type profileJSON struct {
	Age           *int     `json:"age"`
	Sex           *string  `json:"sex"`
	WeightKg      *float64 `json:"weight_kg"`
	HeightCm      *float64 `json:"height_cm"`
	ActivityLevel *string  `json:"activity_level"`
	UpdatedAt     *string  `json:"updated_at"`
}

// loadProfile returns the user's profile as a nutrition.Profile plus the
// updated_at timestamp (nil if the row does not exist).
func (s *Server) loadProfile(ctx context.Context, userID int64) (nutrition.Profile, *int64, error) {
	var p nutrition.Profile
	var updatedAt int64
	err := s.db.QueryRowContext(ctx,
		`SELECT age, sex, weight_kg, height_cm, activity_level, updated_at FROM profiles WHERE user_id = ?`, userID,
	).Scan(&p.Age, &p.Sex, &p.WeightKg, &p.HeightCm, &p.ActivityLevel, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nutrition.Profile{}, nil, nil
	}
	if err != nil {
		return nutrition.Profile{}, nil, err
	}
	return p, &updatedAt, nil
}

func toProfileJSON(p nutrition.Profile, updatedAt *int64) profileJSON {
	out := profileJSON{
		Age:           p.Age,
		Sex:           p.Sex,
		WeightKg:      p.WeightKg,
		HeightCm:      p.HeightCm,
		ActivityLevel: p.ActivityLevel,
	}
	if updatedAt != nil {
		ts := rfc3339(*updatedAt)
		out.UpdatedAt = &ts
	}
	return out
}

func (s *Server) handleGetProfile(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	p, updatedAt, err := s.loadProfile(r.Context(), u.ID)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toProfileJSON(p, updatedAt))
}

func (s *Server) handleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())

	var fields map[string]json.RawMessage
	if err := decodeBody(r, &fields); err != nil {
		badRequest(w, err.Error())
		return
	}

	p, _, err := s.loadProfile(r.Context(), u.ID)
	if err != nil {
		internalError(w, err)
		return
	}
	if err := applyProfilePatch(&p, fields); err != nil {
		badRequest(w, err.Error())
		return
	}

	updatedAt := s.now().Unix()
	if _, err := s.db.ExecContext(r.Context(),
		`INSERT INTO profiles (user_id, age, sex, weight_kg, height_cm, activity_level, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(user_id) DO UPDATE SET
		   age = excluded.age, sex = excluded.sex, weight_kg = excluded.weight_kg,
		   height_cm = excluded.height_cm, activity_level = excluded.activity_level,
		   updated_at = excluded.updated_at`,
		u.ID, p.Age, p.Sex, p.WeightKg, p.HeightCm, p.ActivityLevel, updatedAt); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toProfileJSON(p, &updatedAt))
}

// applyProfilePatch merges a JSON patch (any subset of fields; explicit null
// clears a field) into p, validating each provided value.
func applyProfilePatch(p *nutrition.Profile, fields map[string]json.RawMessage) error {
	for key, raw := range fields {
		isNull := string(raw) == "null"
		switch key {
		case "age":
			if isNull {
				p.Age = nil
				continue
			}
			var v int
			if err := json.Unmarshal(raw, &v); err != nil || v < 10 || v > 120 {
				return errors.New("age must be an integer between 10 and 120")
			}
			p.Age = &v
		case "sex":
			if isNull {
				p.Sex = nil
				continue
			}
			var v string
			if err := json.Unmarshal(raw, &v); err != nil || (v != "male" && v != "female") {
				return errors.New(`sex must be "male" or "female"`)
			}
			p.Sex = &v
		case "weight_kg":
			if isNull {
				p.WeightKg = nil
				continue
			}
			var v float64
			if err := json.Unmarshal(raw, &v); err != nil || v < 20 || v > 400 {
				return errors.New("weight_kg must be a number between 20 and 400")
			}
			p.WeightKg = &v
		case "height_cm":
			if isNull {
				p.HeightCm = nil
				continue
			}
			var v float64
			if err := json.Unmarshal(raw, &v); err != nil || v < 90 || v > 250 {
				return errors.New("height_cm must be a number between 90 and 250")
			}
			p.HeightCm = &v
		case "activity_level":
			if isNull {
				p.ActivityLevel = nil
				continue
			}
			var v string
			if err := json.Unmarshal(raw, &v); err != nil {
				return errors.New("activity_level must be a string")
			}
			if _, ok := nutrition.ActivityMultipliers[v]; !ok {
				return errors.New("activity_level must be one of sedentary, light, moderate, active, very_active")
			}
			p.ActivityLevel = &v
		default:
			return fmt.Errorf("unknown field %q", key)
		}
	}
	return nil
}
