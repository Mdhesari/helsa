// Package db opens the SQLite database and applies the embedded schema.
package db

import (
	"database/sql"
	_ "embed"
	"fmt"

	_ "modernc.org/sqlite"

	"helsa/backend/internal/fooddata"
)

//go:embed schema.sql
var schema string

// Open opens (creating if needed) the SQLite database at path, enables
// foreign keys and a busy timeout on every connection, applies the embedded
// idempotent schema, and seeds the reference food data when it changed.
func Open(path string) (*sql.DB, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)", path)
	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if err := sqlDB.Ping(); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("ping sqlite: %w", err)
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
	if err := fooddata.Seed(sqlDB); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("seed food data: %w", err)
	}
	return sqlDB, nil
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
