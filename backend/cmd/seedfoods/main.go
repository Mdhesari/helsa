// Command seedfoods (re)seeds the reference food data into a Helsa database.
// Normal startup seeding is automatic; use -force to reseed when the embedded
// data hash already matches (e.g. after manual table edits).
package main

import (
	"flag"
	"log"

	"helsa/backend/internal/db"
	"helsa/backend/internal/fooddata"
)

func main() {
	dbPath := flag.String("db", "./helsa.db", "path to the SQLite database")
	force := flag.Bool("force", false, "reseed even when the stored data hash matches")
	flag.Parse()

	sqlDB, err := db.Open(*dbPath) // Open already seeds when the hash changed
	if err != nil {
		log.Fatalf("open %s: %v", *dbPath, err)
	}
	defer sqlDB.Close()

	if *force {
		if err := fooddata.ForceSeed(sqlDB); err != nil {
			log.Fatalf("force seed: %v", err)
		}
	}
	var foods, servings int
	_ = sqlDB.QueryRow(`SELECT count(*) FROM food_ref WHERE owner_user_id IS NULL`).Scan(&foods)
	_ = sqlDB.QueryRow(`SELECT count(*) FROM food_servings`).Scan(&servings)
	log.Printf("seeded: %d reference foods, %d servings", foods, servings)
}
