-- Helsa schema v2 (SQLite). Embedded and applied at startup; keep idempotent.
-- NOTE: the v1 -> v2 profiles migration (drop of the age-based table) runs in
-- db.go BEFORE this file is applied, so the CREATE below always wins.
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

-- v2 goal-based profile. Every field nullable; PUT is a partial upsert.
CREATE TABLE IF NOT EXISTS profiles (
    user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    birth_date       TEXT,   -- nullable; 'YYYY-MM-DD', age 10..120 at write time
    sex              TEXT,   -- nullable; 'male' | 'female' | 'other'
    height_cm        REAL,   -- nullable; 90..250
    weight_kg        REAL,   -- nullable; 20..400 (kept current by POST /weights)
    activity_level   TEXT,   -- nullable; 'sedentary'|'light'|'moderate'|'active'|'very_active'
    goal             TEXT,   -- nullable; 'lose' | 'maintain' | 'gain'
    target_weight_kg REAL,   -- nullable; 20..400
    pace_kg_per_week REAL,   -- nullable; 0.1..1.5
    diet             TEXT,   -- nullable; 'balanced'|'whole_food'|'mediterranean'|'flexitarian'|'pescatarian'|'vegetarian'|'vegan'
    updated_at       INTEGER NOT NULL
);

-- Denormalized nutrient snapshot per log entry. food_ref_id only records which
-- reference food pre-filled the values (client-computed); reports never join it.
-- NOTE: on pre-existing databases food_ref_id is added by ensureColumn in db.go.
CREATE TABLE IF NOT EXISTS food_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_name   TEXT    NOT NULL,
    serving     TEXT    NOT NULL DEFAULT '', -- free text, e.g. "1 cup"
    calories    REAL    NOT NULL DEFAULT 0 CHECK (calories >= 0),
    protein_g   REAL    NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
    carbs_g     REAL    NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
    fat_g       REAL    NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
    logged_at   INTEGER NOT NULL, -- unix seconds, UTC
    created_at  INTEGER NOT NULL,
    food_ref_id INTEGER REFERENCES food_ref(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_food_logs_user_logged_at ON food_logs(user_id, logged_at);
-- idx_food_logs_food_ref is created in db.go after ensureColumn, because on
-- pre-food_ref databases the column does not exist until migration runs.

-- Workout entries. calories is always stored: the client value, or the server
-- estimate (MET x weight x hours) computed once at write time.
CREATE TABLE IF NOT EXISTS workouts (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity           TEXT    NOT NULL, -- 'walking'|'running'|'cycling'|'swimming'|'strength'|'yoga'|'hiit'|'sports'|'other'
    duration_min       INTEGER NOT NULL CHECK (duration_min BETWEEN 1 AND 1440),
    intensity          TEXT    NOT NULL DEFAULT 'moderate', -- 'low' | 'moderate' | 'high'
    calories           REAL    NOT NULL CHECK (calories >= 0),
    calories_estimated INTEGER NOT NULL DEFAULT 0,
    notes              TEXT    NOT NULL DEFAULT '',
    logged_at          INTEGER NOT NULL, -- unix seconds, UTC
    created_at         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_logged_at ON workouts(user_id, logged_at);

-- Weight measurements. Creating the newest one also updates profiles.weight_kg.
CREATE TABLE IF NOT EXISTS weights (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight_kg   REAL    NOT NULL CHECK (weight_kg BETWEEN 20 AND 400),
    measured_at INTEGER NOT NULL, -- unix seconds, UTC
    created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weights_user_measured_at ON weights(user_id, measured_at);

-- Habits. DELETE archives (soft delete) so logs are preserved.
CREATE TABLE IF NOT EXISTS habits (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind         TEXT    NOT NULL, -- 'cigarette' | 'water' | 'coffee' | 'alcohol' | 'custom'
    name         TEXT    NOT NULL,
    unit         TEXT    NOT NULL,
    direction    TEXT    NOT NULL, -- 'reduce' (stay under target) | 'build' (reach at least target)
    daily_target INTEGER CHECK (daily_target IS NULL OR daily_target > 0),
    archived     INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);

CREATE TABLE IF NOT EXISTS habit_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id   INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    count      INTEGER NOT NULL CHECK (count BETWEEN 1 AND 100),
    logged_at  INTEGER NOT NULL, -- unix seconds, UTC
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_logged_at ON habit_logs(habit_id, logged_at);

-- Diary: exactly one row per (user, local date); rows with all content fields
-- null are deleted rather than stored.
CREATE TABLE IF NOT EXISTS diary_entries (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       TEXT    NOT NULL, -- 'YYYY-MM-DD' in the user's timezone
    mood       INTEGER CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
    energy     INTEGER CHECK (energy IS NULL OR energy BETWEEN 1 AND 5),
    text       TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, date)
);

-- Reference foods: global seeded rows (owner_user_id IS NULL) and per-user
-- custom foods (owner_user_id set, source='user'). Nutrients are per
-- nutrient_basis: '100g' for seeded foods, 'serving' for custom foods.
CREATE TABLE IF NOT EXISTS food_ref (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
    source          TEXT    NOT NULL, -- 'usda' | 'curated' | 'user'
    source_key      TEXT,             -- e.g. 'fdc:171705'; NULL for user foods
    name            TEXT    NOT NULL,
    name_norm       TEXT    NOT NULL, -- lowercased; LIKE fallback + prefix ranking
    category        TEXT    NOT NULL DEFAULT '',
    nutrient_basis  TEXT    NOT NULL DEFAULT '100g' CHECK (nutrient_basis IN ('100g','serving')),
    calories        REAL    NOT NULL CHECK (calories >= 0),
    protein_g       REAL    NOT NULL CHECK (protein_g >= 0),
    carbs_g         REAL    NOT NULL CHECK (carbs_g >= 0),
    fat_g           REAL    NOT NULL CHECK (fat_g >= 0),
    popularity_hint INTEGER NOT NULL DEFAULT 0, -- dataset-authored cold-start rank
    created_at      INTEGER NOT NULL,
    UNIQUE(source, source_key)
);

CREATE INDEX IF NOT EXISTS idx_food_ref_owner ON food_ref(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_food_ref_name_norm ON food_ref(name_norm);

CREATE TABLE IF NOT EXISTS food_servings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    food_ref_id INTEGER NOT NULL REFERENCES food_ref(id) ON DELETE CASCADE,
    label       TEXT    NOT NULL,                            -- '1 cup (245 g)'
    grams       REAL    CHECK (grams IS NULL OR grams > 0),  -- NULL only for basis='serving'
    is_default  INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_food_servings_food ON food_servings(food_ref_id);

CREATE TABLE IF NOT EXISTS food_favorites (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_ref_id INTEGER NOT NULL REFERENCES food_ref(id) ON DELETE CASCADE,
    created_at  INTEGER NOT NULL,
    PRIMARY KEY (user_id, food_ref_id)
);

-- One row per searchable string. Persian aliases later become extra rows with
-- the same food_ref_id; no schema change needed.
CREATE VIRTUAL TABLE IF NOT EXISTS food_search USING fts5(
    text,
    food_ref_id UNINDEXED,
    tokenize = "unicode61 remove_diacritics 2"
);

CREATE TABLE IF NOT EXISTS app_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
