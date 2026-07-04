package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

type contextKey struct{}

// UserFromContext returns the authenticated user set by Middleware.
func UserFromContext(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(contextKey{}).(User)
	return u, ok
}

// Middleware returns a middleware that authenticates requests with a Bearer
// JWT. It loads the user from the database on every request and rejects with
// 401 "unauthorized" when the token's pwd_at claim does not match the user's
// current password_changed_at — the sole revocation mechanism.
func Middleware(secret string, db *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, ok := bearerToken(r)
			if !ok {
				unauthorized(w, "missing bearer token")
				return
			}
			userID, pwdAt, err := VerifyToken(secret, token)
			if err != nil {
				unauthorized(w, "invalid or expired token")
				return
			}
			u, err := loadUser(r.Context(), db, userID)
			if errors.Is(err, sql.ErrNoRows) {
				unauthorized(w, "unknown user")
				return
			}
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]any{"error": map[string]string{"code": "internal", "message": "internal error"}})
				return
			}
			if pwdAt != u.PasswordChangedAt {
				unauthorized(w, "token revoked")
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), contextKey{}, u)))
		})
	}
}

func bearerToken(r *http.Request) (string, bool) {
	h := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(h) <= len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
		return "", false
	}
	return strings.TrimSpace(h[len(prefix):]), true
}

func loadUser(ctx context.Context, db *sql.DB, id int64) (User, error) {
	var u User
	err := db.QueryRowContext(ctx,
		`SELECT id, full_name, email, timezone, created_at, password_changed_at FROM users WHERE id = ?`, id,
	).Scan(&u.ID, &u.FullName, &u.Email, &u.Timezone, &u.CreatedAt, &u.PasswordChangedAt)
	return u, err
}

func unauthorized(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]any{"error": map[string]string{"code": "unauthorized", "message": msg}})
}
