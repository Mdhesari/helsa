// Package foodsearch ranks reference foods for instant search. It uses the
// food_search FTS5 table when the SQLite build provides FTS5 and falls back
// to LIKE matching on food_ref.name_norm otherwise.
package foodsearch

import (
	"context"
	"database/sql"
	"strings"
	"unicode"
)

// Available reports whether the connected SQLite build has the FTS5 module.
func Available(db *sql.DB) bool {
	var n int
	err := db.QueryRow(`SELECT count(*) FROM pragma_module_list WHERE name = 'fts5'`).Scan(&n)
	return err == nil && n > 0
}

// tokens lowercases q and splits it on anything that is not a letter or
// digit, so user text can never inject FTS5 query syntax.
func tokens(q string) []string {
	return strings.FieldsFunc(strings.ToLower(q), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})
}

// matchQuery builds an FTS5 MATCH string of AND-ed prefix tokens:
// "chick br" → `chick* br*`. Empty when q has no usable tokens.
func matchQuery(q string) string {
	toks := tokens(q)
	for i, t := range toks {
		toks[i] = t + "*"
	}
	return strings.Join(toks, " ")
}

// Search returns ranked food_ref ids visible to userID: whole-name prefix
// matches first, then bm25 relevance, then popularity (global log count plus
// the dataset hint), then name.
func Search(ctx context.Context, db *sql.DB, userID int64, q string, limit int) ([]int64, error) {
	toks := tokens(q)
	if len(toks) == 0 {
		return nil, nil
	}
	prefix := strings.Join(toks, " ") + "%"

	var rows *sql.Rows
	var err error
	if Available(db) {
		// bm25() is only valid selecting straight off the FTS table; the CTE
		// must be MATERIALIZED or the planner flattens it and loses that
		// context ("unable to use function bm25 in the requested context").
		rows, err = db.QueryContext(ctx, `
			WITH hits AS MATERIALIZED (
				SELECT food_ref_id AS id, bm25(food_search) AS score
				FROM food_search WHERE food_search MATCH ?1
			), m AS (
				SELECT id, min(score) AS score FROM hits GROUP BY id
			)
			SELECT f.id
			FROM m JOIN food_ref f ON f.id = m.id
			WHERE f.owner_user_id IS NULL OR f.owner_user_id = ?2
			ORDER BY (f.name_norm LIKE ?3) DESC,
			         m.score ASC,
			         ((SELECT count(*) FROM food_logs fl WHERE fl.food_ref_id = f.id) + f.popularity_hint) DESC,
			         f.name_norm ASC
			LIMIT ?4`, matchQuery(q), userID, prefix, limit)
	} else {
		// Tokens are alphanumeric only, so they are safe inside LIKE patterns.
		var b strings.Builder
		args := []any{userID}
		for _, t := range toks {
			b.WriteString(" AND f.name_norm LIKE ?")
			args = append(args, "%"+t+"%")
		}
		args = append(args, prefix, limit)
		rows, err = db.QueryContext(ctx, `
			SELECT f.id FROM food_ref f
			WHERE (f.owner_user_id IS NULL OR f.owner_user_id = ?)`+b.String()+`
			ORDER BY (f.name_norm LIKE ?) DESC,
			         ((SELECT count(*) FROM food_logs fl WHERE fl.food_ref_id = f.id) + f.popularity_hint) DESC,
			         f.name_norm ASC
			LIMIT ?`, args...)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
