-- Helsa schema v1 (SQLite). Embedded and applied at startup; keep idempotent.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name           TEXT    NOT NULL,
    email               TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash       TEXT    NOT NULL,
    password_changed_at INTEGER NOT NULL, -- unix seconds; compared against JWT pwd_at claim (sole revocation mechanism)
    timezone            TEXT    NOT NULL DEFAULT 'UTC', -- IANA name
    created_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
    user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    age            INTEGER,          -- nullable; 10..120
    sex            TEXT,             -- nullable; 'male' | 'female'
    weight_kg      REAL,             -- nullable; 20..400
    height_cm      REAL,             -- nullable; 90..250
    activity_level TEXT,             -- nullable; 'sedentary'|'light'|'moderate'|'active'|'very_active'
    updated_at     INTEGER NOT NULL
);

-- Denormalized nutrient snapshot per log entry. A future seeded food-reference table
-- (food_ref) will only pre-fill these values; add a nullable food_ref_id via migration then.
CREATE TABLE IF NOT EXISTS food_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_name  TEXT    NOT NULL,
    serving    TEXT    NOT NULL DEFAULT '', -- free text, e.g. "1 cup"
    calories   REAL    NOT NULL DEFAULT 0 CHECK (calories >= 0),
    protein_g  REAL    NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
    carbs_g    REAL    NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
    fat_g      REAL    NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
    logged_at  INTEGER NOT NULL, -- unix seconds, UTC
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_food_logs_user_logged_at ON food_logs(user_id, logged_at);
