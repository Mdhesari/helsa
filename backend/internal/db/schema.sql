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
