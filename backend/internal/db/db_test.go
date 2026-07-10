package db_test

import (
	"database/sql"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"

	"helsa/backend/internal/db"
	"helsa/backend/internal/fooddata"
)

func hasColumn(t *testing.T, sqlDB *sql.DB, table, column string) bool {
	t.Helper()
	var n int
	if err := sqlDB.QueryRow(
		`SELECT count(*) FROM pragma_table_info(?) WHERE name = ?`, table, column).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n > 0
}

func TestOpenFreshDB(t *testing.T) {
	sqlDB, err := db.Open(filepath.Join(t.TempDir(), "fresh.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	if !hasColumn(t, sqlDB, "food_logs", "food_ref_id") {
		t.Error("fresh DB: food_logs.food_ref_id missing")
	}

	// Seeding ran: reference foods, servings and search rows exist.
	var foods, servings, search int
	if err := sqlDB.QueryRow(`SELECT count(*) FROM food_ref WHERE owner_user_id IS NULL`).Scan(&foods); err != nil {
		t.Fatal(err)
	}
	if err := sqlDB.QueryRow(`SELECT count(*) FROM food_servings`).Scan(&servings); err != nil {
		t.Fatal(err)
	}
	if err := sqlDB.QueryRow(`SELECT count(*) FROM food_search`).Scan(&search); err != nil {
		t.Fatal(err)
	}
	if foods == 0 || servings < foods || search != foods {
		t.Errorf("seed counts: foods=%d servings=%d search=%d", foods, servings, search)
	}

	// FTS5 MATCH round-trip pins the modernc build assumption.
	var hits int
	if err := sqlDB.QueryRow(
		`SELECT count(*) FROM food_search WHERE food_search MATCH 'chick*'`).Scan(&hits); err != nil {
		t.Fatalf("FTS5 MATCH failed: %v", err)
	}
	if hits == 0 {
		t.Error("FTS5 MATCH 'chick*' found nothing")
	}
}

func TestOpenMigratesV1DB(t *testing.T) {
	path := filepath.Join(t.TempDir(), "v1.db")

	// Build a pre-food_ref database shape by hand.
	raw, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := raw.Exec(`
		CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL,
			email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
			password_changed_at INTEGER NOT NULL, timezone TEXT NOT NULL DEFAULT 'UTC',
			created_at INTEGER NOT NULL);
		CREATE TABLE food_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			food_name TEXT NOT NULL, serving TEXT NOT NULL DEFAULT '',
			calories REAL NOT NULL DEFAULT 0, protein_g REAL NOT NULL DEFAULT 0,
			carbs_g REAL NOT NULL DEFAULT 0, fat_g REAL NOT NULL DEFAULT 0,
			logged_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
		INSERT INTO users (full_name, email, password_hash, password_changed_at, created_at)
			VALUES ('U', 'u@x.com', 'h', 0, 0);
		INSERT INTO food_logs (user_id, food_name, logged_at, created_at) VALUES (1, 'old row', 1, 1);
	`); err != nil {
		t.Fatal(err)
	}
	raw.Close()

	sqlDB, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	if !hasColumn(t, sqlDB, "food_logs", "food_ref_id") {
		t.Error("migrated DB: food_logs.food_ref_id missing")
	}
	var name string
	var refID sql.NullInt64
	if err := sqlDB.QueryRow(
		`SELECT food_name, food_ref_id FROM food_logs WHERE id = 1`).Scan(&name, &refID); err != nil {
		t.Fatal(err)
	}
	if name != "old row" || refID.Valid {
		t.Errorf("pre-existing row after migration: name=%q refID=%v", name, refID)
	}
}

func TestSeedIdempotentAndPreservesUserFoods(t *testing.T) {
	path := filepath.Join(t.TempDir(), "seed.db")
	sqlDB, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	count := func(q string) int {
		var n int
		if err := sqlDB.QueryRow(q).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	foods1 := count(`SELECT count(*) FROM food_ref`)
	servings1 := count(`SELECT count(*) FROM food_servings`)

	// A user-created custom food must survive reseeding.
	if _, err := sqlDB.Exec(`INSERT INTO users (full_name, email, password_hash, password_changed_at, created_at)
		VALUES ('U', 'u@x.com', 'h', 0, 0)`); err != nil {
		t.Fatal(err)
	}
	if _, err := sqlDB.Exec(`
		INSERT INTO food_ref (owner_user_id, source, name, name_norm, nutrient_basis,
		                      calories, protein_g, carbs_g, fat_g, created_at)
		VALUES (1, 'user', 'My Smoothie', 'my smoothie', 'serving', 200, 5, 30, 6, 0)`); err != nil {
		t.Fatal(err)
	}

	if err := fooddata.Seed(sqlDB); err != nil { // hash unchanged → no-op
		t.Fatal(err)
	}
	if err := fooddata.ForceSeed(sqlDB); err != nil { // full re-upsert
		t.Fatal(err)
	}

	if got := count(`SELECT count(*) FROM food_ref`); got != foods1+1 {
		t.Errorf("food_ref count after reseed = %d, want %d", got, foods1+1)
	}
	if got := count(`SELECT count(*) FROM food_servings`); got != servings1 {
		t.Errorf("food_servings count after reseed = %d, want %d", got, servings1)
	}
	if got := count(`SELECT count(*) FROM food_ref WHERE name = 'My Smoothie'`); got != 1 {
		t.Error("custom food lost during reseed")
	}
}
