// Package fooddata embeds the curated reference-food datasets and seeds them
// into the food_ref / food_servings / food_search tables.
package fooddata

import (
	"embed"
	"encoding/json"
	"fmt"
	"strings"
)

//go:embed foods.usda.json foods.persian.json
var files embed.FS

var datasetNames = []string{"foods.usda.json", "foods.persian.json"}

// Nutrients holds the four tracked values, per the entry's basis (100 g for
// all seeded foods).
type Nutrients struct {
	Calories float64 `json:"calories"`
	ProteinG float64 `json:"protein_g"`
	CarbsG   float64 `json:"carbs_g"`
	FatG     float64 `json:"fat_g"`
}

// ServingDef is one selectable serving size for a food.
type ServingDef struct {
	Label   string   `json:"label"`
	Grams   *float64 `json:"grams"`
	Default bool     `json:"default"`
}

// Entry is one food in a dataset file.
type Entry struct {
	Source         string       `json:"source"`     // 'usda' | 'curated'
	SourceKey      string       `json:"source_key"` // stable slug, e.g. 'chicken-breast-grilled'
	Name           string       `json:"name"`
	Category       string       `json:"category"`
	Per100g        Nutrients    `json:"per_100g"`
	Servings       []ServingDef `json:"servings"`
	PopularityHint int          `json:"popularity_hint"`
	Note           string       `json:"note"` // provenance; not stored
}

// Normalize lowercases and collapses whitespace; used for food_ref.name_norm
// (LIKE fallback + prefix ranking) at seed time and for custom foods.
func Normalize(name string) string {
	return strings.Join(strings.Fields(strings.ToLower(name)), " ")
}

func loadEntries() ([]Entry, [][]byte, error) {
	var all []Entry
	var blobs [][]byte
	for _, name := range datasetNames {
		b, err := files.ReadFile(name)
		if err != nil {
			return nil, nil, fmt.Errorf("read %s: %w", name, err)
		}
		var entries []Entry
		if err := json.Unmarshal(b, &entries); err != nil {
			return nil, nil, fmt.Errorf("parse %s: %w", name, err)
		}
		for i, e := range entries {
			if e.Source == "" || e.SourceKey == "" || strings.TrimSpace(e.Name) == "" {
				return nil, nil, fmt.Errorf("%s entry %d: source, source_key and name are required", name, i)
			}
		}
		all = append(all, entries...)
		blobs = append(blobs, b)
	}
	return all, blobs, nil
}
