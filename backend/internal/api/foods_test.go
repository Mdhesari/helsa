package api_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"helsa/backend/internal/api"
	"helsa/backend/internal/db"
	"helsa/backend/internal/insights"
)

type foodResp struct {
	ID            int64   `json:"id"`
	Name          string  `json:"name"`
	Category      string  `json:"category"`
	IsCustom      bool    `json:"is_custom"`
	NutrientBasis string  `json:"nutrient_basis"`
	Calories      float64 `json:"calories"`
	IsFavorite    bool    `json:"is_favorite"`
	Servings      []struct {
		ID        int64    `json:"id"`
		Label     string   `json:"label"`
		Grams     *float64 `json:"grams"`
		IsDefault bool     `json:"is_default"`
	} `json:"servings"`
}

func registerUser(t *testing.T, base, email string) string {
	t.Helper()
	var reg struct {
		Token string `json:"token"`
	}
	resp := doJSON(t, http.MethodPost, base+"/auth/register", "", map[string]any{
		"full_name": "T", "email": email, "password": "secret123", "timezone": "UTC",
	}, &reg)
	if resp.StatusCode != 201 || reg.Token == "" {
		t.Fatalf("register %s = %d", email, resp.StatusCode)
	}
	return reg.Token
}

func TestFoods(t *testing.T) {
	sqlDB, err := db.Open(filepath.Join(t.TempDir(), "foods.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()
	srv := httptest.NewServer(api.New(sqlDB, "test-secret", insights.StubProvider{}).Handler())
	defer srv.Close()
	base := srv.URL + "/api/v1"

	alice := registerUser(t, base, "alice@x.com")
	bob := registerUser(t, base, "bob@x.com")

	// --- Search: empty q is a 400.
	if resp := doJSON(t, http.MethodGet, base+"/foods?q=", alice, nil, nil); resp.StatusCode != 400 {
		t.Errorf("empty q = %d, want 400", resp.StatusCode)
	}

	// --- Search ranking: "chick" puts chicken foods first, prefix match on top.
	var search struct {
		Foods []foodResp `json:"foods"`
	}
	if resp := doJSON(t, http.MethodGet, base+"/foods?q=chick", alice, nil, &search); resp.StatusCode != 200 {
		t.Fatalf("search chick = %d", resp.StatusCode)
	}
	if len(search.Foods) == 0 {
		t.Fatal("search chick: no results")
	}
	if !strings.HasPrefix(strings.ToLower(search.Foods[0].Name), "chick") {
		t.Errorf("search chick: top result %q is not a prefix match", search.Foods[0].Name)
	}
	if len(search.Foods[0].Servings) == 0 {
		t.Error("search result has no servings")
	}

	// --- Persian dish reachable by prefix.
	if resp := doJSON(t, http.MethodGet, base+"/foods?q=gho", alice, nil, &search); resp.StatusCode != 200 {
		t.Fatalf("search gho = %d", resp.StatusCode)
	}
	found := false
	for _, f := range search.Foods {
		if strings.Contains(f.Name, "Ghormeh sabzi") {
			found = true
		}
	}
	if !found {
		t.Error("search gho: ghormeh sabzi not found")
	}

	// --- Custom food creation and per-user isolation.
	var custom foodResp
	if resp := doJSON(t, http.MethodPost, base+"/foods", alice, map[string]any{
		"name": "Alice Protein Shake", "serving_label": "1 bottle",
		"calories": 210, "protein_g": 30, "carbs_g": 12, "fat_g": 4,
	}, &custom); resp.StatusCode != 201 {
		t.Fatalf("create custom food = %d", resp.StatusCode)
	}
	if !custom.IsCustom || custom.NutrientBasis != "serving" ||
		len(custom.Servings) != 1 || custom.Servings[0].Grams != nil {
		t.Errorf("custom food shape: %+v", custom)
	}

	fURL := fmt.Sprintf("%s/foods/%d", base, custom.ID)
	if resp := doJSON(t, http.MethodGet, fURL, alice, nil, nil); resp.StatusCode != 200 {
		t.Errorf("owner GET custom food = %d", resp.StatusCode)
	}
	if resp := doJSON(t, http.MethodGet, fURL, bob, nil, nil); resp.StatusCode != 404 {
		t.Errorf("foreign GET custom food = %d, want 404", resp.StatusCode)
	}
	if resp := doJSON(t, http.MethodGet, base+"/foods?q=alice+protein", bob, nil, &search); resp.StatusCode != 200 {
		t.Fatal("bob search failed")
	}
	if len(search.Foods) != 0 {
		t.Error("bob can search alice's custom food")
	}

	// --- Favorites: idempotent add/remove, visible in suggestions.
	favURL := fURL + "/favorite"
	for i := 0; i < 2; i++ {
		if resp := doJSON(t, http.MethodPut, favURL, alice, nil, nil); resp.StatusCode != 204 {
			t.Fatalf("favorite add #%d = %d", i+1, resp.StatusCode)
		}
	}
	if resp := doJSON(t, http.MethodPut, favURL, bob, nil, nil); resp.StatusCode != 404 {
		t.Errorf("bob favoriting alice's food = %d, want 404", resp.StatusCode)
	}

	// --- Log with food_ref_id: valid, invalid, foreign.
	var log struct {
		ID        int64  `json:"id"`
		FoodRefID *int64 `json:"food_ref_id"`
	}
	if resp := doJSON(t, http.MethodPost, base+"/logs", alice, map[string]any{
		"food_name": "Alice Protein Shake", "serving": "1 bottle",
		"calories": 210, "protein_g": 30, "carbs_g": 12, "fat_g": 4, "food_ref_id": custom.ID,
	}, &log); resp.StatusCode != 201 {
		t.Fatalf("log with food_ref_id = %d", resp.StatusCode)
	}
	if log.FoodRefID == nil || *log.FoodRefID != custom.ID {
		t.Errorf("log food_ref_id = %v, want %d", log.FoodRefID, custom.ID)
	}
	if resp := doJSON(t, http.MethodPost, base+"/logs", alice, map[string]any{
		"food_name": "x", "food_ref_id": 99999,
	}, nil); resp.StatusCode != 400 {
		t.Errorf("log with unknown food_ref_id = %d, want 400", resp.StatusCode)
	}
	if resp := doJSON(t, http.MethodPost, base+"/logs", bob, map[string]any{
		"food_name": "x", "food_ref_id": custom.ID,
	}, nil); resp.StatusCode != 400 {
		t.Errorf("log with foreign food_ref_id = %d, want 400", resp.StatusCode)
	}

	// --- Suggestions: recent (from the log above), favorites, popular.
	var sug struct {
		Recent    []foodResp `json:"recent"`
		Favorites []foodResp `json:"favorites"`
		Popular   []foodResp `json:"popular"`
	}
	if resp := doJSON(t, http.MethodGet, base+"/foods/suggestions", alice, nil, &sug); resp.StatusCode != 200 {
		t.Fatalf("suggestions = %d", resp.StatusCode)
	}
	if len(sug.Recent) == 0 || sug.Recent[0].ID != custom.ID {
		t.Errorf("recent: %+v", sug.Recent)
	}
	if len(sug.Favorites) != 1 || sug.Favorites[0].ID != custom.ID || !sug.Favorites[0].IsFavorite {
		t.Errorf("favorites: %+v", sug.Favorites)
	}
	if len(sug.Popular) != 10 {
		t.Errorf("popular size = %d, want 10", len(sug.Popular))
	}

	// PUT with explicit null clears the reference.
	if resp := doJSON(t, http.MethodPut, fmt.Sprintf("%s/logs/%d", base, log.ID), alice,
		map[string]any{"food_ref_id": nil}, &log); resp.StatusCode != 200 {
		t.Fatalf("clear food_ref_id = %d", resp.StatusCode)
	}
	if log.FoodRefID != nil {
		t.Error("food_ref_id not cleared by explicit null")
	}

	// Remove favorite twice: idempotent 204s.
	for i := 0; i < 2; i++ {
		if resp := doJSON(t, http.MethodDelete, favURL, alice, nil, nil); resp.StatusCode != 204 {
			t.Fatalf("favorite remove #%d = %d", i+1, resp.StatusCode)
		}
	}
}
