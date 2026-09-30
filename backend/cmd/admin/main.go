// Command admin is the Helsa operator CLI, shipped as helsa-admin in the
// backend image. It works directly on the SQLite database, so run it where the
// database lives; in production that is inside the backend container:
//
//	docker compose exec backend helsa-admin set-password -email sara@x.com
package main

import (
	"context"
	"database/sql"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"golang.org/x/term"

	"helsa/backend/internal/auth"
	"helsa/backend/internal/db"
)

const usageText = `usage: helsa-admin <command> [flags]

commands:
  set-password   set a user's password and sign them out everywhere

Run "helsa-admin <command> -h" for a command's flags.
`

const setPasswordUsage = `usage: helsa-admin set-password -email <email> [-password-stdin] [-db <path>]

Sets a user's password without needing the current one, and revokes every
session they have, the same as a change through PUT /me/password.
Prompts twice for the new password without echoing it; with -password-stdin
it reads one line from stdin instead, for scripts.

flags:
`

// usageError is a mistake in how the CLI was invoked (exit 2, the flag
// package's convention), as opposed to a failure doing the work (exit 1).
type usageError string

func (e usageError) Error() string { return string(e) }

func main() {
	os.Exit(run(os.Args[1:], os.Stdin, os.Stdout, os.Stderr))
}

// run executes one command and returns the process exit code.
func run(args []string, stdin *os.File, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		fmt.Fprint(stderr, usageText)
		return 2
	}
	var err error
	switch args[0] {
	case "set-password":
		err = setPassword(args[1:], stdin, stdout, stderr)
	case "help", "-h", "-help", "--help":
		fmt.Fprint(stdout, usageText)
		return 0
	default:
		fmt.Fprintf(stderr, "helsa-admin: unknown command %q\n\n%s", args[0], usageText)
		return 2
	}
	var usage usageError
	switch {
	case err == nil:
		return 0
	case errors.As(err, &usage):
		fmt.Fprintf(stderr, "helsa-admin %s: %v\nRun \"helsa-admin %s -h\" for usage.\n", args[0], err, args[0])
		return 2
	default:
		fmt.Fprintf(stderr, "helsa-admin %s: %v\n", args[0], err)
		return 1
	}
}

func setPassword(args []string, stdin *os.File, stdout, stderr io.Writer) error {
	fs := flag.NewFlagSet("set-password", flag.ContinueOnError)
	fs.SetOutput(io.Discard) // run reports parse errors; -h is printed below
	email := fs.String("email", "", "email of the account to update (required)")
	fromStdin := fs.Bool("password-stdin", false, "read the new password from stdin instead of prompting")
	dbPath := fs.String("db", defaultDBPath(), "SQLite database; defaults to $DB_PATH, else ./helsa.db")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			fmt.Fprint(stdout, setPasswordUsage)
			fs.SetOutput(stdout)
			fs.PrintDefaults()
			return nil
		}
		return usageError(err.Error())
	}
	if fs.NArg() > 0 {
		return usageError(fmt.Sprintf("unexpected argument %q; name the account with -email", fs.Arg(0)))
	}
	addr := strings.ToLower(strings.TrimSpace(*email)) // same normalization as login
	if addr == "" {
		return usageError("-email is required")
	}
	// Settle where the password comes from before touching the database.
	fd := int(stdin.Fd())
	tty := term.IsTerminal(fd)
	switch {
	case *fromStdin && tty:
		// Typed into a terminal it would echo, and reading waits for Ctrl-D.
		return usageError("-password-stdin needs the password piped in (with docker compose exec, add -T)")
	case !*fromStdin && !tty:
		return usageError("stdin is not a terminal; pipe the password in with -password-stdin")
	}

	sqlDB, err := db.OpenExisting(*dbPath)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer sqlDB.Close()

	var id int64
	var name, stored string
	err = sqlDB.QueryRow(`SELECT id, full_name, email FROM users WHERE email = ?`, addr).Scan(&id, &name, &stored)
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("no user with email %s in %s", addr, *dbPath)
	}
	if err != nil {
		return fmt.Errorf("look up %s: %w", addr, err)
	}
	who := fmt.Sprintf("%s <%s>", name, stored)

	var password string
	if *fromStdin {
		password, err = readPasswordLine(stdin)
	} else {
		password, err = promptPassword(fd, stderr, who)
	}
	if err != nil {
		return err
	}
	if len(password) < auth.MinPasswordLength {
		return fmt.Errorf("password must be at least %d characters", auth.MinPasswordLength)
	}
	if len(password) > auth.MaxPasswordLength {
		return fmt.Errorf("password must be at most %d bytes", auth.MaxPasswordLength)
	}

	if _, err := auth.SetPassword(context.Background(), sqlDB, id, password, time.Now()); err != nil {
		return fmt.Errorf("set password: %w", err)
	}
	fmt.Fprintf(stdout, "Password changed for %s; every existing session is signed out.\n", who)
	return nil
}

// promptPassword reads the new password twice from the terminal, unechoed.
func promptPassword(fd int, stderr io.Writer, who string) (string, error) {
	fmt.Fprintf(stderr, "New password for %s: ", who)
	first, err := term.ReadPassword(fd)
	fmt.Fprintln(stderr)
	if err != nil {
		return "", fmt.Errorf("read password: %w", err)
	}
	fmt.Fprint(stderr, "Repeat new password: ")
	second, err := term.ReadPassword(fd)
	fmt.Fprintln(stderr)
	if err != nil {
		return "", fmt.Errorf("read password: %w", err)
	}
	if string(first) != string(second) {
		return "", errors.New("passwords do not match")
	}
	return string(first), nil
}

// readPasswordLine reads a password piped to stdin: exactly one line, with or
// without its trailing newline.
func readPasswordLine(r io.Reader) (string, error) {
	b, err := io.ReadAll(r)
	if err != nil {
		return "", fmt.Errorf("read password from stdin: %w", err)
	}
	password := strings.TrimSuffix(strings.TrimSuffix(string(b), "\n"), "\r")
	if strings.ContainsAny(password, "\r\n") {
		return "", errors.New("password from stdin must be a single line")
	}
	return password, nil
}

// defaultDBPath matches the server's DB_PATH default, so inside the backend
// container the CLI finds /data/helsa.db without flags.
func defaultDBPath() string {
	if p := os.Getenv("DB_PATH"); p != "" {
		return p
	}
	return "./helsa.db"
}
