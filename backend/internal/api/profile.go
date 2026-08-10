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
	"helsa/backend/internal/nutrition"
)

// profileJSON is the v2 Profile shape from the contract; every field is
// nullable. updated_at is null when the profile has never been set.
type profileJSON struct {
	BirthDate      *string  `json:"birth_date"`
	Sex            *string  `json:"sex"`
	HeightCm       *float64 `json:"height_cm"`
	WeightKg       *float64 `json:"weight_kg"`
	ActivityLevel  *string  `json:"activity_level"`
	Goal           *string  `json:"goal"`
	TargetWeightKg *float64 `json:"target_weight_kg"`
	PaceKgPerWeek  *float64 `json:"pace_kg_per_week"`
	Diet           *string  `json:"diet"`
	UpdatedAt      *string  `json:"updated_at"`
}

// diets is the closed diet enum from the contract.
var diets = map[string]bool{
	"balanced": true, "whole_food": true, "mediterranean": true,
	"flexitarian": true, "pescatarian": true, "vegetarian": true, "vegan": true,
}

// loadProfile returns the user's profile as a nutrition.Profile plus the
// updated_at timestamp (nil if the row does not exist).
func (s *Server) loadProfile(ctx context.Context, userID int64) (nutrition.Profile, *int64, error) {
	var p nutrition.Profile
	var updatedAt int64
	err := s.db.QueryRowContext(ctx,
		`SELECT birth_date, sex, height_cm, weight_kg, activity_level, goal,
		        target_weight_kg, pace_kg_per_week, diet, updated_at
		 FROM profiles WHERE user_id = ?`, userID,
	).Scan(&p.BirthDate, &p.Sex, &p.HeightCm, &p.WeightKg, &p.ActivityLevel,
		&p.Goal, &p.TargetWeightKg, &p.PaceKgPerWeek, &p.Diet, &updatedAt)
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
		BirthDate:      p.BirthDate,
		Sex:            p.Sex,
		HeightCm:       p.HeightCm,
		WeightKg:       p.WeightKg,
		ActivityLevel:  p.ActivityLevel,
		Goal:           p.Goal,
		TargetWeightKg: p.TargetWeightKg,
		PaceKgPerWeek:  p.PaceKgPerWeek,
		Diet:           p.Diet,
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
	if err := applyProfilePatch(&p, fields, s.now().In(userLocation(u))); err != nil {
		badRequest(w, err.Error())
		return
	}

	updatedAt := s.now().Unix()
	if err := s.upsertProfile(r.Context(), u.ID, p, updatedAt); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toProfileJSON(p, &updatedAt))
}

// upsertProfile writes the full profile row for a user.
func (s *Server) upsertProfile(ctx context.Context, userID int64, p nutrition.Profile, updatedAt int64) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO profiles (user_id, birth_date, sex, height_cm, weight_kg, activity_level,
		                       goal, target_weight_kg, pace_kg_per_week, diet, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(user_id) DO UPDATE SET
		   birth_date = excluded.birth_date, sex = excluded.sex,
		   height_cm = excluded.height_cm, weight_kg = excluded.weight_kg,
		   activity_level = excluded.activity_level, goal = excluded.goal,
		   target_weight_kg = excluded.target_weight_kg,
		   pace_kg_per_week = excluded.pace_kg_per_week, diet = excluded.diet,
		   updated_at = excluded.updated_at`,
		userID, p.BirthDate, p.Sex, p.HeightCm, p.WeightKg, p.ActivityLevel,
		p.Goal, p.TargetWeightKg, p.PaceKgPerWeek, p.Diet, updatedAt)
	return err
}

// applyProfilePatch merges a JSON patch (any subset of fields; explicit null
// clears a field) into p, validating each provided value. today is the
// current local date in the user's timezone, used for the age bound.
func applyProfilePatch(p *nutrition.Profile, fields map[string]json.RawMessage, today time.Time) error {
	setString := func(raw json.RawMessage, dst **string, valid func(string) bool, msg string) error {
		if string(raw) == "null" {
			*dst = nil
			return nil
		}
		var v string
		if err := json.Unmarshal(raw, &v); err != nil || !valid(v) {
			return errors.New(msg)
		}
		*dst = &v
		return nil
	}
	setFloat := func(raw json.RawMessage, dst **float64, min, max float64, name string) error {
		if string(raw) == "null" {
			*dst = nil
			return nil
		}
		var v float64
		if err := json.Unmarshal(raw, &v); err != nil || v < min || v > max {
			return fmt.Errorf("%s must be a number between %v and %v", name, min, max)
		}
		*dst = &v
		return nil
	}

	for key, raw := range fields {
		var err error
		switch key {
		case "birth_date":
			err = setString(raw, &p.BirthDate, func(v string) bool {
				age, ok := nutrition.Age(v, today)
				return ok && age >= 10 && age <= 120
			}, "birth_date must be a valid YYYY-MM-DD date yielding an age between 10 and 120")
		case "sex":
			err = setString(raw, &p.Sex, func(v string) bool {
				return v == "male" || v == "female" || v == "other"
			}, `sex must be "male", "female" or "other"`)
		case "height_cm":
			err = setFloat(raw, &p.HeightCm, 90, 250, "height_cm")
		case "weight_kg":
			err = setFloat(raw, &p.WeightKg, 20, 400, "weight_kg")
		case "activity_level":
			err = setString(raw, &p.ActivityLevel, func(v string) bool {
				_, ok := nutrition.ActivityMultipliers[v]
				return ok
			}, "activity_level must be one of sedentary, light, moderate, active, very_active")
		case "goal":
			err = setString(raw, &p.Goal, func(v string) bool {
				return v == "lose" || v == "maintain" || v == "gain"
			}, `goal must be "lose", "maintain" or "gain"`)
		case "target_weight_kg":
			err = setFloat(raw, &p.TargetWeightKg, 20, 400, "target_weight_kg")
		case "pace_kg_per_week":
			err = setFloat(raw, &p.PaceKgPerWeek, 0.1, 1.5, "pace_kg_per_week")
		case "diet":
			err = setString(raw, &p.Diet, func(v string) bool { return diets[v] },
				"diet must be one of balanced, whole_food, mediterranean, flexitarian, pescatarian, vegetarian, vegan")
		default:
			err = fmt.Errorf("unknown field %q", key)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// userPlan loads the profile and derives the plan in the user's timezone.
func (s *Server) userPlan(ctx context.Context, u auth.User) (nutrition.Plan, error) {
	p, _, err := s.loadProfile(ctx, u.ID)
	if err != nil {
		return nutrition.Plan{}, err
	}
	return nutrition.ComputePlan(p, s.now(), userLocation(u)), nil
}

func (s *Server) handleGetPlan(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	plan, err := s.userPlan(r.Context(), u)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, plan)
}
