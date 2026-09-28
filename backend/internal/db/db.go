// Package db opens the SQLite database and applies the embedded schema.
package db

import (
	"database/sql"
	_ "embed"
	"fmt"
	"os"

	_ "modernc.org/sqlite"

	"helsa/backend/internal/fooddata"
)

//go:embed schema.sql
var schema string

// pragmas are applied to every connection by both Open and OpenExisting.
const pragmas = "_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)"

// Open opens (creating if needed) the SQLite database at path, enables
// foreign keys and a busy timeout on every connection, applies the embedded
// idempotent schema, and seeds the reference food data when it changed.
func Open(path string) (*sql.DB, error) {
	dsn := fmt.Sprintf("file:%s?%s", path, pragmas)
	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if err := sqlDB.Ping(); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	// v1 -> v2: the age-based profiles table is destructively rebuilt (dev
	// data per the contract). Must run BEFORE the schema so the CREATE IF NOT
	// EXISTS recreates it with the v2 shape. users, food_ref and food_logs
	// are untouched.
	if err := dropLegacyProfiles(sqlDB); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("migrate profiles: %w", err)
	}
	if _, err := sqlDB.Exec(schema); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	// Databases created before food_ref existed lack this column; the CREATE
	// in schema.sql is skipped for them (IF NOT EXISTS), so patch it here.
	if err := ensureColumn(sqlDB, "food_logs", "food_ref_id",
		"food_ref_id INTEGER REFERENCES food_ref(id) ON DELETE SET NULL"); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("migrate food_logs: %w", err)
	}
	if _, err := sqlDB.Exec(
		`CREATE INDEX IF NOT EXISTS idx_food_logs_food_ref ON food_logs(food_ref_id)`); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("index food_logs.food_ref_id: %w", err)
	}
	// Same story for client_key, added with the offline outbox: every table
	// backing an offline-queueable write gets one, scoped by whichever column
	// makes the key unique per user. Partial index so unlimited NULL rows
	// (ordinary online writes) coexist.
	for _, t := range []struct{ table, scope string }{
		{"food_logs", "user_id"},
		{"workouts", "user_id"},
		{"weights", "user_id"},
		{"habit_logs", "habit_id"}, // habit_logs has no user_id; habit ownership scopes it
	} {
		if err := ensureColumn(sqlDB, t.table, "client_key", "client_key TEXT"); err != nil {
			sqlDB.Close()
			return nil, fmt.Errorf("migrate %s.client_key: %w", t.table, err)
		}
		if _, err := sqlDB.Exec(fmt.Sprintf(
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_%s_client_key
			 ON %s(%s, client_key) WHERE client_key IS NOT NULL`,
			t.table, t.table, t.scope)); err != nil {
			sqlDB.Close()
			return nil, fmt.Errorf("index %s.client_key: %w", t.table, err)
		}
	}
	if err := fooddata.Seed(sqlDB); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("seed food data: %w", err)
	}
	return sqlDB, nil
}

// OpenExisting opens the database at path with the same connection pragmas as
// Open, but fails when the file does not exist and never applies the schema or
// seeds. Admin tools use it so a mistyped path cannot leave a fresh empty
// database behind, and a live database is never migrated as a side effect.
func OpenExisting(path string) (*sql.DB, error) {
	// mode=rw is what guarantees no file gets created; the Stat is only for a
	// readable error, since SQLite reports a missing file as "out of memory (14)".
	if _, err := os.Stat(path); err != nil {
		return nil, err
	}
	dsn := fmt.Sprintf("file:%s?mode=rw&%s", path, pragmas)
	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if err := sqlDB.Ping(); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	return sqlDB, nil
}

// dropLegacyProfiles removes a v1 profiles table (recognized by its "age"
// column, absent in v2) so the schema recreates it with the v2 shape.
func dropLegacyProfiles(db *sql.DB) error {
	var n int
	if err := db.QueryRow(
		`SELECT count(*) FROM pragma_table_info('profiles') WHERE name = 'age'`,
	).Scan(&n); err != nil {
		return err
	}
	if n == 0 {
		return nil
	}
	_, err := db.Exec(`DROP TABLE profiles`)
	return err
}

// ensureColumn adds a column when missing (SQLite has no ADD COLUMN IF NOT
// EXISTS). ddl is the full column definition, e.g. "foo INTEGER DEFAULT 0".
func ensureColumn(db *sql.DB, table, column, ddl string) error {
	var n int
	if err := db.QueryRow(
		`SELECT count(*) FROM pragma_table_info(?) WHERE name = ?`, table, column,
	).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	_, err := db.Exec(`ALTER TABLE ` + table + ` ADD COLUMN ` + ddl)
	return err
}
