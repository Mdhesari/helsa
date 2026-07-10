package api

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"helsa/backend/internal/auth"
	"helsa/backend/internal/fooddata"
	"helsa/backend/internal/foodsearch"
)

// servingJSON is the FoodServing shape from the contract.
type servingJSON struct {
	ID        int64    `json:"id"`
	Label     string   `json:"label"`
	Grams     *float64 `json:"grams"` // null for per-serving custom foods
	IsDefault bool     `json:"is_default"`
}

// foodJSON is the Food shape from the contract; nutrients are per
// nutrient_basis ("100g" for seeded foods, "serving" for custom foods).
type foodJSON struct {
	ID            int64         `json:"id"`
	Name          string        `json:"name"`
	Category      string        `json:"category"`
	IsCustom      bool          `json:"is_custom"`
	NutrientBasis string        `json:"nutrient_basis"`
	Calories      float64       `json:"calories"`
	ProteinG      float64       `json:"protein_g"`
	CarbsG        float64       `json:"carbs_g"`
	FatG          float64       `json:"fat_g"`
	IsFavorite    bool          `json:"is_favorite"`
	Servings      []servingJSON `json:"servings"`
}

// loadFoods returns the foods visible to userID for the given ids, preserving
// the ids' order (search/suggestion ranking). Unknown or foreign ids are
// silently dropped. Servings are ordered default-first.
func (s *Server) loadFoods(ctx context.Context, userID int64, ids []int64) ([]foodJSON, error) {
	if len(ids) == 0 {
		return []foodJSON{}, nil
	}
	placeholders := strings.Repeat("?,", len(ids)-1) + "?"
	args := make([]any, 0, len(ids)+2)
	args = append(args, userID)
	for _, id := range ids {
		args = append(args, id)
	}

	byID := make(map[int64]*foodJSON, len(ids))
	rows, err := s.db.QueryContext(ctx, `
		SELECT f.id, f.name, f.category, f.owner_user_id IS NOT NULL, f.nutrient_basis,
		       f.calories, f.protein_g, f.carbs_g, f.fat_g,
		       EXISTS(SELECT 1 FROM food_favorites ff WHERE ff.user_id = ?1 AND ff.food_ref_id = f.id)
		FROM food_ref f
		WHERE f.id IN (`+placeholders+`) AND (f.owner_user_id IS NULL OR f.owner_user_id = ?1)`,
		args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var f foodJSON
		if err := rows.Scan(&f.ID, &f.Name, &f.Category, &f.IsCustom, &f.NutrientBasis,
			&f.Calories, &f.ProteinG, &f.CarbsG, &f.FatG, &f.IsFavorite); err != nil {
			return nil, err
		}
		f.Servings = []servingJSON{}
		byID[f.ID] = &f
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	srows, err := s.db.QueryContext(ctx, `
		SELECT id, food_ref_id, label, grams, is_default
		FROM food_servings WHERE food_ref_id IN (`+placeholders+`)
		ORDER BY is_default DESC, sort_order ASC, id ASC`, args[1:]...)
	if err != nil {
		return nil, err
	}
	defer srows.Close()
	for srows.Next() {
		var sv servingJSON
		var foodID int64
		var grams sql.NullFloat64
		var isDefault int
		if err := srows.Scan(&sv.ID, &foodID, &sv.Label, &grams, &isDefault); err != nil {
			return nil, err
		}
		if grams.Valid {
			sv.Grams = &grams.Float64
		}
		sv.IsDefault = isDefault != 0
		if f, ok := byID[foodID]; ok {
			f.Servings = append(f.Servings, sv)
		}
	}
	if err := srows.Err(); err != nil {
		return nil, err
	}

	out := make([]foodJSON, 0, len(byID))
	for _, id := range ids {
		if f, ok := byID[id]; ok {
			out = append(out, *f)
			delete(byID, id) // guard against duplicate ids in the input
		}
	}
	return out, nil
}

func (s *Server) handleSearchFoods(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		badRequest(w, "q is required")
		return
	}
	limit := 20
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 50 {
			badRequest(w, "limit must be between 1 and 50")
			return
		}
		limit = n
	}
	ids, err := foodsearch.Search(r.Context(), s.db, u.ID, q, limit)
	if err != nil {
		internalError(w, err)
		return
	}
	foods, err := s.loadFoods(r.Context(), u.ID, ids)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"foods": foods})
}

func (s *Server) handleFoodSuggestions(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	ctx := r.Context()

	idsFor := func(query string, args ...any) ([]int64, error) {
		rows, err := s.db.QueryContext(ctx, query, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var ids []int64
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				return nil, err
			}
			ids = append(ids, id)
		}
		return ids, rows.Err()
	}

	recentIDs, err := idsFor(`
		SELECT fl.food_ref_id
		FROM food_logs fl JOIN food_ref f ON f.id = fl.food_ref_id
		WHERE fl.user_id = ?1 AND (f.owner_user_id IS NULL OR f.owner_user_id = ?1)
		GROUP BY fl.food_ref_id ORDER BY max(fl.logged_at) DESC LIMIT 8`, u.ID)
	if err != nil {
		internalError(w, err)
		return
	}
	favoriteIDs, err := idsFor(`
		SELECT ff.food_ref_id
		FROM food_favorites ff JOIN food_ref f ON f.id = ff.food_ref_id
		WHERE ff.user_id = ?1 AND (f.owner_user_id IS NULL OR f.owner_user_id = ?1)
		ORDER BY ff.created_at DESC LIMIT 12`, u.ID)
	if err != nil {
		internalError(w, err)
		return
	}
	popularIDs, err := idsFor(`
		SELECT f.id FROM food_ref f
		WHERE f.owner_user_id IS NULL
		ORDER BY ((SELECT count(*) FROM food_logs fl WHERE fl.food_ref_id = f.id) * 1000
		          + f.popularity_hint) DESC, f.name_norm ASC
		LIMIT 10`)
	if err != nil {
		internalError(w, err)
		return
	}

	out := map[string][]foodJSON{}
	for key, ids := range map[string][]int64{
		"recent": recentIDs, "favorites": favoriteIDs, "popular": popularIDs,
	} {
		foods, err := s.loadFoods(ctx, u.ID, ids)
		if err != nil {
			internalError(w, err)
			return
		}
		out[key] = foods
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleGetFood(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "food not found")
		return
	}
	foods, err := s.loadFoods(r.Context(), u.ID, []int64{id})
	if err != nil {
		internalError(w, err)
		return
	}
	if len(foods) == 0 {
		writeError(w, http.StatusNotFound, "not_found", "food not found")
		return
	}
	writeJSON(w, http.StatusOK, foods[0])
}

// customFoodInput is the POST /foods body; nutrients are per the named serving.
type customFoodInput struct {
	Name         string   `json:"name"`
	ServingLabel string   `json:"serving_label"`
	Calories     *float64 `json:"calories"`
	ProteinG     *float64 `json:"protein_g"`
	CarbsG       *float64 `json:"carbs_g"`
	FatG         *float64 `json:"fat_g"`
}

func (s *Server) handleCreateFood(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var req customFoodInput
	if err := decodeBody(r, &req); err != nil {
		badRequest(w, err.Error())
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		badRequest(w, "name is required")
		return
	}
	label := strings.TrimSpace(req.ServingLabel)
	if label == "" {
		label = "1 serving"
	}
	nutrients := [4]float64{}
	for i, f := range []*float64{req.Calories, req.ProteinG, req.CarbsG, req.FatG} {
		if f == nil {
			continue
		}
		if *f < 0 {
			badRequest(w, "nutrient values must be >= 0")
			return
		}
		nutrients[i] = *f
	}

	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		internalError(w, err)
		return
	}
	defer tx.Rollback()
	now := s.now().Unix()
	var foodID int64
	err = tx.QueryRowContext(r.Context(), `
		INSERT INTO food_ref (owner_user_id, source, source_key, name, name_norm, category,
		                      nutrient_basis, calories, protein_g, carbs_g, fat_g, popularity_hint, created_at)
		VALUES (?, 'user', NULL, ?, ?, 'Custom', 'serving', ?, ?, ?, ?, 0, ?)
		RETURNING id`,
		u.ID, req.Name, fooddata.Normalize(req.Name),
		nutrients[0], nutrients[1], nutrients[2], nutrients[3], now,
	).Scan(&foodID)
	if err != nil {
		internalError(w, err)
		return
	}
	if _, err := tx.ExecContext(r.Context(), `
		INSERT INTO food_servings (food_ref_id, label, grams, is_default, sort_order)
		VALUES (?, ?, NULL, 1, 0)`, foodID, label); err != nil {
		internalError(w, err)
		return
	}
	if _, err := tx.ExecContext(r.Context(),
		`INSERT INTO food_search (text, food_ref_id) VALUES (?, ?)`, req.Name, foodID); err != nil {
		internalError(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, err)
		return
	}

	foods, err := s.loadFoods(r.Context(), u.ID, []int64{foodID})
	if err != nil || len(foods) == 0 {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, foods[0])
}

// visibleFoodExists reports whether the food exists and is global or owned by
// userID.
func (s *Server) visibleFoodExists(ctx context.Context, userID, foodID int64) (bool, error) {
	var one int
	err := s.db.QueryRowContext(ctx, `
		SELECT 1 FROM food_ref
		WHERE id = ? AND (owner_user_id IS NULL OR owner_user_id = ?)`, foodID, userID).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (s *Server) handleAddFavorite(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "food not found")
		return
	}
	visible, err := s.visibleFoodExists(r.Context(), u.ID, id)
	if err != nil {
		internalError(w, err)
		return
	}
	if !visible {
		writeError(w, http.StatusNotFound, "not_found", "food not found")
		return
	}
	if _, err := s.db.ExecContext(r.Context(), `
		INSERT OR IGNORE INTO food_favorites (user_id, food_ref_id, created_at)
		VALUES (?, ?, ?)`, u.ID, id, s.now().Unix()); err != nil {
		internalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleRemoveFavorite(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, ok := pathID(r)
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "food not found")
		return
	}
	if _, err := s.db.ExecContext(r.Context(),
		`DELETE FROM food_favorites WHERE user_id = ? AND food_ref_id = ?`, u.ID, id); err != nil {
		internalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
