package foodsearch_test

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"helsa/backend/internal/db"
	"helsa/backend/internal/foodsearch"
)

func TestSearchRanking(t *testing.T) {
	sqlDB, err := db.Open(filepath.Join(t.TempDir(), "search.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	if !foodsearch.Available(sqlDB) {
		t.Fatal("FTS5 not available in this SQLite build")
	}

	ids, err := foodsearch.Search(context.Background(), sqlDB, 1, "chick", 20)
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(ids) == 0 {
		t.Fatal("no results for 'chick'")
	}
	var name string
	if err := sqlDB.QueryRow(`SELECT name FROM food_ref WHERE id = ?`, ids[0]).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(strings.ToLower(name), "chick") {
		t.Errorf("top result %q is not a prefix match", name)
	}

	// No-token query returns nothing rather than erroring.
	ids, err = foodsearch.Search(context.Background(), sqlDB, 1, "!!!", 20)
	if err != nil || len(ids) != 0 {
		t.Errorf("punctuation-only query: ids=%v err=%v", ids, err)
	}
}
