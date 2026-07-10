package fooddata

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

const hashKey = "fooddata_hash"

// Seed upserts the embedded datasets into food_ref/food_servings and rebuilds
// the food_search rows for global foods. It is a no-op when the embedded data
// hash matches app_meta, so it is safe to call on every startup. User-created
// foods (owner_user_id set) are never touched.
func Seed(db *sql.DB) error {
	return seed(db, false)
}

// ForceSeed reseeds even when the stored hash matches (cmd/seedfoods -force).
func ForceSeed(db *sql.DB) error {
	return seed(db, true)
}

func seed(db *sql.DB, force bool) error {
	entries, blobs, err := loadEntries()
	if err != nil {
		return err
	}
	h := sha256.New()
	for _, b := range blobs {
		h.Write(b)
	}
	hash := hex.EncodeToString(h.Sum(nil))

	if !force {
		var stored string
		err := db.QueryRow(`SELECT value FROM app_meta WHERE key = ?`, hashKey).Scan(&stored)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if stored == hash {
			return nil
		}
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().Unix()
	for _, e := range entries {
		var id int64
		err := tx.QueryRow(
			`INSERT INTO food_ref (owner_user_id, source, source_key, name, name_norm, category,
			                       nutrient_basis, calories, protein_g, carbs_g, fat_g, popularity_hint, created_at)
			 VALUES (NULL, ?, ?, ?, ?, ?, '100g', ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(source, source_key) DO UPDATE SET
			   name = excluded.name, name_norm = excluded.name_norm, category = excluded.category,
			   calories = excluded.calories, protein_g = excluded.protein_g,
			   carbs_g = excluded.carbs_g, fat_g = excluded.fat_g,
			   popularity_hint = excluded.popularity_hint
			 RETURNING id`,
			e.Source, e.SourceKey, e.Name, Normalize(e.Name), e.Category,
			e.Per100g.Calories, e.Per100g.ProteinG, e.Per100g.CarbsG, e.Per100g.FatG,
			e.PopularityHint, now,
		).Scan(&id)
		if err != nil {
			return fmt.Errorf("upsert %s/%s: %w", e.Source, e.SourceKey, err)
		}
		if _, err := tx.Exec(`DELETE FROM food_servings WHERE food_ref_id = ?`, id); err != nil {
			return err
		}
		servings := e.Servings
		// Every seeded food is per-100g; guarantee a plain 100 g option.
		has100 := false
		for _, s := range servings {
			if s.Grams != nil && *s.Grams == 100 {
				has100 = true
			}
		}
		if !has100 {
			g := 100.0
			servings = append(servings, ServingDef{Label: "100 g", Grams: &g})
		}
		defaultIdx := 0
		for i, s := range servings {
			if s.Default {
				defaultIdx = i
				break
			}
		}
		for i, s := range servings {
			if s.Grams == nil {
				return fmt.Errorf("%s/%s serving %q: grams required for seeded foods", e.Source, e.SourceKey, s.Label)
			}
			isDefault := 0
			if i == defaultIdx {
				isDefault = 1
			}
			if _, err := tx.Exec(
				`INSERT INTO food_servings (food_ref_id, label, grams, is_default, sort_order)
				 VALUES (?, ?, ?, ?, ?)`, id, s.Label, *s.Grams, isDefault, i); err != nil {
				return err
			}
		}
	}

	// Rebuild search rows for all global foods (self-healing against drift).
	if _, err := tx.Exec(
		`DELETE FROM food_search WHERE food_ref_id IN
		   (SELECT id FROM food_ref WHERE owner_user_id IS NULL)`); err != nil {
		return err
	}
	if _, err := tx.Exec(
		`INSERT INTO food_search (text, food_ref_id)
		 SELECT name, id FROM food_ref WHERE owner_user_id IS NULL`); err != nil {
		return err
	}

	if _, err := tx.Exec(
		`INSERT INTO app_meta (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`, hashKey, hash); err != nil {
		return err
	}
	return tx.Commit()
}
