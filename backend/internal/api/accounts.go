package api

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"helsa/backend/internal/auth"
)

// userJSON is the User shape from the contract.
type userJSON struct {
	ID        int64  `json:"id"`
	FullName  string `json:"full_name"`
	Email     string `json:"email"`
	Timezone  string `json:"timezone"`
	CreatedAt string `json:"created_at"`
}

func toUserJSON(u auth.User) userJSON {
	return userJSON{
		ID:        u.ID,
		FullName:  u.FullName,
		Email:     u.Email,
		Timezone:  u.Timezone,
		CreatedAt: rfc3339(u.CreatedAt),
	}
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FullName string  `json:"full_name"`
		Email    string  `json:"email"`
		Password string  `json:"password"`
		Timezone *string `json:"timezone"`
	}
	if err := decodeBody(r, &req); err != nil {
		badRequest(w, err.Error())
		return
	}
	req.FullName = strings.TrimSpace(req.FullName)
	email := strings.ToLower(strings.TrimSpace(req.Email))
	switch {
	case req.FullName == "":
		badRequest(w, "full_name is required")
		return
	case email == "" || !strings.Contains(email, "@"):
		badRequest(w, "a valid email is required")
		return
	case len(req.Password) < 8:
		badRequest(w, "password must be at least 8 characters")
		return
	}
	tz := "UTC"
	if req.Timezone != nil {
		tz = strings.TrimSpace(*req.Timezone)
		if _, err := time.LoadLocation(tz); err != nil || tz == "" {
			badRequest(w, "timezone must be a valid IANA name")
			return
		}
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		internalError(w, err)
		return
	}
	now := s.now().Unix()
	res, err := s.db.ExecContext(r.Context(),
		`INSERT INTO users (full_name, email, password_hash, password_changed_at, timezone, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		req.FullName, email, hash, now, tz, now)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			writeError(w, http.StatusConflict, "email_taken", "an account with this email already exists")
			return
		}
		internalError(w, err)
		return
	}
	id, err := res.LastInsertId()
	if err != nil {
		internalError(w, err)
		return
	}
	u := auth.User{ID: id, FullName: req.FullName, Email: email, Timezone: tz, CreatedAt: now, PasswordChangedAt: now}
	token, err := auth.IssueToken(s.jwtSecret, u.ID, u.PasswordChangedAt, s.now())
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"token": token, "user": toUserJSON(u)})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeBody(r, &req); err != nil {
		badRequest(w, err.Error())
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	var u auth.User
	var hash string
	err := s.db.QueryRowContext(r.Context(),
		`SELECT id, full_name, email, timezone, created_at, password_changed_at, password_hash
		 FROM users WHERE email = ?`, email,
	).Scan(&u.ID, &u.FullName, &u.Email, &u.Timezone, &u.CreatedAt, &u.PasswordChangedAt, &hash)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !auth.CheckPassword(hash, req.Password)) {
		// Identical response for unknown email and wrong password.
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	token, err := auth.IssueToken(s.jwtSecret, u.ID, u.PasswordChangedAt, s.now())
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": toUserJSON(u)})
}

func (s *Server) handleGetMe(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	writeJSON(w, http.StatusOK, toUserJSON(u))
}

func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var req struct {
		FullName *string `json:"full_name"`
		Timezone *string `json:"timezone"`
	}
	if err := decodeBody(r, &req); err != nil {
		badRequest(w, err.Error())
		return
	}
	if req.FullName == nil && req.Timezone == nil {
		badRequest(w, "at least one of full_name or timezone is required")
		return
	}
	if req.FullName != nil {
		name := strings.TrimSpace(*req.FullName)
		if name == "" {
			badRequest(w, "full_name must be non-empty")
			return
		}
		u.FullName = name
	}
	if req.Timezone != nil {
		tz := strings.TrimSpace(*req.Timezone)
		if _, err := time.LoadLocation(tz); err != nil || tz == "" {
			badRequest(w, "timezone must be a valid IANA name")
			return
		}
		u.Timezone = tz
	}
	if _, err := s.db.ExecContext(r.Context(),
		`UPDATE users SET full_name = ?, timezone = ? WHERE id = ?`, u.FullName, u.Timezone, u.ID); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toUserJSON(u))
}

func (s *Server) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := decodeBody(r, &req); err != nil {
		badRequest(w, err.Error())
		return
	}
	if len(req.NewPassword) < 8 {
		badRequest(w, "new_password must be at least 8 characters")
		return
	}
	var hash string
	if err := s.db.QueryRowContext(r.Context(),
		`SELECT password_hash FROM users WHERE id = ?`, u.ID).Scan(&hash); err != nil {
		internalError(w, err)
		return
	}
	if !auth.CheckPassword(hash, req.CurrentPassword) {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "current password is incorrect")
		return
	}
	newHash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		internalError(w, err)
		return
	}
	// Guarantee pwd_at moves forward even within the same second, so every
	// previously issued token is revoked.
	changedAt := s.now().Unix()
	if changedAt <= u.PasswordChangedAt {
		changedAt = u.PasswordChangedAt + 1
	}
	if _, err := s.db.ExecContext(r.Context(),
		`UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?`,
		newHash, changedAt, u.ID); err != nil {
		internalError(w, err)
		return
	}
	token, err := auth.IssueToken(s.jwtSecret, u.ID, changedAt, s.now())
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"token": token})
}
