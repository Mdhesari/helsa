package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"helsa/backend/internal/auth"
	"helsa/backend/internal/db"
)

const oldChangedAt = 1750000000

// newDB creates a migrated database holding Sara, whose password is
// "old-password", and returns its path.
func newDB(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "helsa.db")
	sqlDB, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()
	hash, err := auth.HashPassword("old-password")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := sqlDB.Exec(
		`INSERT INTO users (full_name, email, password_hash, password_changed_at, timezone, created_at)
		 VALUES ('Sara K', 'sara@x.com', ?, ?, 'UTC', ?)`, hash, oldChangedAt, oldChangedAt); err != nil {
		t.Fatal(err)
	}
	return path
}

// stdinWith returns a non-terminal stdin that yields content, like a pipe.
func stdinWith(t *testing.T, content string) *os.File {
	t.Helper()
	path := filepath.Join(t.TempDir(), "stdin")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { f.Close() })
	return f
}

// storedPassword returns Sara's password hash and password_changed_at.
func storedPassword(t *testing.T, path string) (hash string, changedAt int64) {
	t.Helper()
	sqlDB, err := db.OpenExisting(path)
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()
	if err := sqlDB.QueryRow(
		`SELECT password_hash, password_changed_at FROM users WHERE email = 'sara@x.com'`,
	).Scan(&hash, &changedAt); err != nil {
		t.Fatal(err)
	}
	return hash, changedAt
}

func TestSetPassword(t *testing.T) {
	path := newDB(t)
	var stdout, stderr bytes.Buffer
	code := run([]string{"set-password", "-db", path, "-email", " Sara@X.com ", "-password-stdin"},
		stdinWith(t, "new-password\n"), &stdout, &stderr)
	if code != 0 {
		t.Fatalf("exit %d, stderr: %s", code, stderr.String())
	}
	if !strings.Contains(stdout.String(), "Sara K <sara@x.com>") {
		t.Errorf("stdout = %q, want it to name the account", stdout.String())
	}

	hash, changedAt := storedPassword(t, path)
	if !auth.CheckPassword(hash, "new-password") || auth.CheckPassword(hash, "old-password") {
		t.Error("stored hash should match the new password and only the new one")
	}
	// A later pwd_at is what revokes the tokens issued before the change.
	if changedAt <= oldChangedAt {
		t.Errorf("password_changed_at = %d, want > %d", changedAt, oldChangedAt)
	}
}

func TestSetPasswordRejects(t *testing.T) {
	path := newDB(t)
	missing := filepath.Join(t.TempDir(), "missing.db")
	set := func(extra ...string) []string {
		return append([]string{"set-password", "-db", path}, extra...)
	}

	tests := []struct {
		name  string
		args  []string
		stdin string
		code  int
		want  string // substring of stdout+stderr
	}{
		{"no command", nil, "", 2, "usage: helsa-admin <command>"},
		{"unknown command", []string{"reset"}, "", 2, `unknown command "reset"`},
		{"help", []string{"set-password", "-h"}, "", 0, "usage: helsa-admin set-password"},
		{"unknown flag", set("-nope"), "", 2, "flag provided but not defined: -nope"},
		{"missing email", set("-password-stdin"), "new-password", 2, "-email is required"},
		{"positional email", set("sara@x.com"), "", 2, `unexpected argument "sara@x.com"`},
		{"piped without -password-stdin", set("-email", "sara@x.com"), "new-password", 2, "stdin is not a terminal"},
		{"unknown user", set("-email", "nobody@x.com", "-password-stdin"), "new-password", 1, "no user with email nobody@x.com"},
		{"short password", set("-email", "sara@x.com", "-password-stdin"), "short\n", 1, "at least 8 characters"},
		{"empty stdin", set("-email", "sara@x.com", "-password-stdin"), "", 1, "at least 8 characters"},
		{"two lines", set("-email", "sara@x.com", "-password-stdin"), "new-password\nmore\n", 1, "single line"},
		{"missing database", []string{"set-password", "-db", missing, "-email", "sara@x.com", "-password-stdin"},
			"new-password", 1, "no such file or directory"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var stdout, stderr bytes.Buffer
			code := run(tt.args, stdinWith(t, tt.stdin), &stdout, &stderr)
			out := stdout.String() + stderr.String()
			if code != tt.code || !strings.Contains(out, tt.want) {
				t.Fatalf("exit %d, output %q; want exit %d and %q", code, out, tt.code, tt.want)
			}
		})
	}

	hash, changedAt := storedPassword(t, path)
	if !auth.CheckPassword(hash, "old-password") || changedAt != oldChangedAt {
		t.Error("a rejected run changed the stored password")
	}
	if _, err := os.Stat(missing); !os.IsNotExist(err) {
		t.Errorf("a mistyped -db left a file behind (stat err: %v)", err)
	}
}
