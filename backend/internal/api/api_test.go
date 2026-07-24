package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"helsa/backend/internal/api"
	"helsa/backend/internal/db"
	"helsa/backend/internal/insights"
)

// doJSON performs a request with an optional bearer token and decodes the
// JSON response into out (skipped when out is nil).
func doJSON(t *testing.T, method, url, token string, body any, out any) *http.Response {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		reader = bytes.NewReader(b)
	} else {
		reader = bytes.NewReader(nil)
	}
	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			t.Fatalf("decode %s %s response: %v", method, url, err)
		}
	}
	return resp
}

// newTestServer spins up a full API server against a fresh temp database.
func newTestServer(t *testing.T) (base string) {
	t.Helper()
	sqlDB, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sqlDB.Close() })
	srv := httptest.NewServer(api.New(sqlDB, "test-secret", insights.StubProvider{}).Handler())
	t.Cleanup(srv.Close)
	return srv.URL + "/api/v1"
}

// register creates a user and returns a bearer token.
func register(t *testing.T, base, name, email, timezone string) string {
	t.Helper()
	var reg struct {
		Token string `json:"token"`
	}
	resp := doJSON(t, http.MethodPost, base+"/auth/register", "", map[string]any{
		"full_name": name, "email": email, "password": "secret123", "timezone": timezone,
	}, &reg)
	if resp.StatusCode != http.StatusCreated || reg.Token == "" {
		t.Fatalf("register %s = %d", email, resp.StatusCode)
	}
	return reg.Token
}

func TestHappyPath(t *testing.T) {
	base := newTestServer(t)

	// Health, no auth.
	var health struct {
		Status string `json:"status"`
	}
	if resp := doJSON(t, http.MethodGet, base+"/health", "", nil, &health); resp.StatusCode != 200 || health.Status != "ok" {
		t.Fatalf("health = %d %+v", resp.StatusCode, health)
	}

	// Register.
	var reg struct {
		Token string `json:"token"`
		User  struct {
			ID       int64  `json:"id"`
			Email    string `json:"email"`
			Timezone string `json:"timezone"`
		} `json:"user"`
	}
	resp := doJSON(t, http.MethodPost, base+"/auth/register", "", map[string]any{
		"full_name": "Sara K", "email": "Sara@X.com", "password": "secret123", "timezone": "Asia/Tehran",
	}, &reg)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("register status = %d", resp.StatusCode)
	}
	if reg.Token == "" || reg.User.Email != "sara@x.com" || reg.User.Timezone != "Asia/Tehran" {
		t.Fatalf("register response = %+v (email must be normalized lowercase)", reg)
	}

	// Duplicate email → 409 email_taken.
	var dupErr struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	resp = doJSON(t, http.MethodPost, base+"/auth/register", "", map[string]any{
		"full_name": "Sara Again", "email": "sara@x.com", "password": "secret123",
	}, &dupErr)
	if resp.StatusCode != http.StatusConflict || dupErr.Error.Code != "email_taken" {
		t.Fatalf("duplicate register = %d %+v, want 409 email_taken", resp.StatusCode, dupErr)
	}

	// Login.
	var login struct {
		Token string `json:"token"`
	}
	resp = doJSON(t, http.MethodPost, base+"/auth/login", "", map[string]any{
		"email": "sara@x.com", "password": "secret123",
	}, &login)
	if resp.StatusCode != 200 || login.Token == "" {
		t.Fatalf("login = %d %+v", resp.StatusCode, login)
	}
	token := login.Token

	// Wrong password → identical 401 invalid_credentials.
	var loginErr struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	resp = doJSON(t, http.MethodPost, base+"/auth/login", "", map[string]any{
		"email": "sara@x.com", "password": "wrongpass",
	}, &loginErr)
	if resp.StatusCode != http.StatusUnauthorized || loginErr.Error.Code != "invalid_credentials" {
		t.Fatalf("bad login = %d %+v, want 401 invalid_credentials", resp.StatusCode, loginErr)
	}

	// Create a log (logged_at defaults to now → today's bucket).
	var created struct {
		ID       int64   `json:"id"`
		FoodName string  `json:"food_name"`
		Calories float64 `json:"calories"`
	}
	resp = doJSON(t, http.MethodPost, base+"/logs", token, map[string]any{
		"food_name": "Greek yogurt", "serving": "1 cup", "calories": 150, "protein_g": 20, "carbs_g": 8, "fat_g": 4,
	}, &created)
	if resp.StatusCode != http.StatusCreated || created.ID == 0 || created.FoodName != "Greek yogurt" {
		t.Fatalf("create log = %d %+v", resp.StatusCode, created)
	}

	// Dashboard reflects today's totals and the streak.
	var dash struct {
		Plan struct {
			Complete bool `json:"complete"`
			Targets  *any `json:"targets"`
		} `json:"plan"`
		Today struct {
			Date string `json:"date"`
			Food struct {
				Totals struct {
					Calories float64 `json:"calories"`
					ProteinG float64 `json:"protein_g"`
					CarbsG   float64 `json:"carbs_g"`
					FatG     float64 `json:"fat_g"`
				} `json:"totals"`
				LogCount int `json:"log_count"`
			} `json:"food"`
			Remaining *any `json:"remaining"`
		} `json:"today"`
		Streak struct {
			CurrentDays int `json:"current_days"`
			LongestDays int `json:"longest_days"`
		} `json:"streak"`
	}
	resp = doJSON(t, http.MethodGet, base+"/dashboard", token, nil, &dash)
	if resp.StatusCode != 200 {
		t.Fatalf("dashboard status = %d", resp.StatusCode)
	}
	if dash.Plan.Complete || dash.Plan.Targets != nil || dash.Today.Remaining != nil {
		t.Errorf("empty profile must give plan.complete=false, null targets and null remaining: %+v", dash)
	}
	tt := dash.Today.Food.Totals
	if dash.Today.Food.LogCount != 1 || tt.Calories != 150 || tt.ProteinG != 20 || tt.CarbsG != 8 || tt.FatG != 4 {
		t.Errorf("today.food = %+v, want 1 log with 150/20/8/4", dash.Today.Food)
	}
	if dash.Streak.CurrentDays != 1 || dash.Streak.LongestDays != 1 {
		t.Errorf("streak = %+v, want 1/1", dash.Streak)
	}

	// Dashboard without a token → 401 unauthorized.
	var authErr struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	resp = doJSON(t, http.MethodGet, base+"/dashboard", "", nil, &authErr)
	if resp.StatusCode != http.StatusUnauthorized || authErr.Error.Code != "unauthorized" {
		t.Fatalf("unauthenticated dashboard = %d %+v, want 401 unauthorized", resp.StatusCode, authErr)
	}
}
