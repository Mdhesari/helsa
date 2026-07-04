package auth_test

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"helsa/backend/internal/auth"
	"helsa/backend/internal/db"
)

const secret = "test-secret"

func TestPasswordHashRoundTrip(t *testing.T) {
	hash, err := auth.HashPassword("secret123")
	if err != nil {
		t.Fatal(err)
	}
	if !auth.CheckPassword(hash, "secret123") {
		t.Error("correct password rejected")
	}
	if auth.CheckPassword(hash, "wrongpass") {
		t.Error("wrong password accepted")
	}
}

func TestTokenRoundTrip(t *testing.T) {
	token, err := auth.IssueToken(secret, 42, 1700000000, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	userID, pwdAt, err := auth.VerifyToken(secret, token)
	if err != nil {
		t.Fatal(err)
	}
	if userID != 42 || pwdAt != 1700000000 {
		t.Fatalf("got userID %d pwdAt %d, want 42 / 1700000000", userID, pwdAt)
	}
}

func TestVerifyTokenRejections(t *testing.T) {
	expired, err := auth.IssueToken(secret, 1, 100, time.Now().Add(-8*24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	valid, err := auth.IssueToken(secret, 1, 100, time.Now())
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name, secret, token string
	}{
		{"expired token", secret, expired},
		{"wrong secret", "other-secret", valid},
		{"garbage token", secret, "not.a.jwt"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, _, err := auth.VerifyToken(tt.secret, tt.token); err == nil {
				t.Fatal("VerifyToken() should fail")
			}
		})
	}
}

func TestMiddlewareRevocation(t *testing.T) {
	sqlDB, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	const pwdChangedAt = 1750000000
	res, err := sqlDB.Exec(
		`INSERT INTO users (full_name, email, password_hash, password_changed_at, timezone, created_at)
		 VALUES ('Sara K', 's@x.com', 'hash', ?, 'UTC', ?)`, pwdChangedAt, pwdChangedAt)
	if err != nil {
		t.Fatal(err)
	}
	userID, err := res.LastInsertId()
	if err != nil {
		t.Fatal(err)
	}

	handler := auth.Middleware(secret, sqlDB)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := auth.UserFromContext(r.Context())
		if !ok || u.Email != "s@x.com" {
			t.Errorf("user missing from context: %+v ok=%v", u, ok)
		}
		w.WriteHeader(http.StatusOK)
	}))

	freshToken, err := auth.IssueToken(secret, userID, pwdChangedAt, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	staleToken, err := auth.IssueToken(secret, userID, pwdChangedAt-1, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	expiredToken, err := auth.IssueToken(secret, userID, pwdChangedAt, time.Now().Add(-8*24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	unknownUserToken, err := auth.IssueToken(secret, userID+999, pwdChangedAt, time.Now())
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name   string
		header string
		status int
	}{
		{"valid token", "Bearer " + freshToken, http.StatusOK},
		{"stale pwd_at revoked", "Bearer " + staleToken, http.StatusUnauthorized},
		{"expired token", "Bearer " + expiredToken, http.StatusUnauthorized},
		{"unknown user", "Bearer " + unknownUserToken, http.StatusUnauthorized},
		{"missing header", "", http.StatusUnauthorized},
		{"malformed header", "Token abc", http.StatusUnauthorized},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/protected", nil)
			if tt.header != "" {
				req.Header.Set("Authorization", tt.header)
			}
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != tt.status {
				t.Fatalf("status = %d, want %d (body: %s)", rec.Code, tt.status, rec.Body.String())
			}
		})
	}
}
