// Package auth provides password hashing and changes, JWT issue/verify and
// the authentication middleware with pwd_at-based revocation.
package auth

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// TokenTTL is the JWT lifetime.
const TokenTTL = 7 * 24 * time.Hour

// MinPasswordLength is the shortest password accepted wherever one is set.
const MinPasswordLength = 8

// User is the authenticated user loaded from the database on every request.
type User struct {
	ID                int64
	FullName          string
	Email             string
	Timezone          string
	CreatedAt         int64 // unix seconds
	PasswordChangedAt int64 // unix seconds
}

// HashPassword hashes a plaintext password with bcrypt at default cost.
func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// CheckPassword reports whether password matches the bcrypt hash.
func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// SetPassword replaces a user's password and moves password_changed_at
// forward, which revokes every token issued before the change. It returns the
// new password_changed_at (the pwd_at for a fresh token), or sql.ErrNoRows
// when the user does not exist. Callers enforce MinPasswordLength.
func SetPassword(ctx context.Context, db *sql.DB, userID int64, password string, now time.Time) (int64, error) {
	hash, err := HashPassword(password)
	if err != nil {
		return 0, err
	}
	// max(...) keeps pwd_at strictly increasing even within the same second,
	// so tokens issued earlier in that second are revoked too.
	var changedAt int64
	err = db.QueryRowContext(ctx,
		`UPDATE users SET password_hash = ?, password_changed_at = max(?, password_changed_at + 1)
		 WHERE id = ? RETURNING password_changed_at`,
		hash, now.Unix(), userID,
	).Scan(&changedAt)
	return changedAt, err
}

type claims struct {
	PwdAt int64 `json:"pwd_at"`
	jwt.RegisteredClaims
}

// IssueToken signs an HS256 JWT with sub/iat/exp/pwd_at claims.
func IssueToken(secret string, userID int64, passwordChangedAt int64, now time.Time) (string, error) {
	c := claims{
		PwdAt: passwordChangedAt,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(userID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(TokenTTL)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString([]byte(secret))
}

// VerifyToken parses and validates a token, returning the user id and the
// pwd_at claim. Expired, malformed or wrongly-signed tokens return an error.
func VerifyToken(secret, token string) (userID int64, pwdAt int64, err error) {
	var c claims
	_, err = jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (any, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithExpirationRequired())
	if err != nil {
		return 0, 0, err
	}
	userID, err = strconv.ParseInt(c.Subject, 10, 64)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid sub claim: %w", err)
	}
	return userID, c.PwdAt, nil
}
