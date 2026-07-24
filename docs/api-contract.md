# Helsa API Contract (v2) — OpenAPI-lite

This document is the single source of truth for the backend and frontend. Both are built
against it independently; do not deviate without updating this file.

v2 redesigns Helsa into a CalAI-style health tracker: a goal-based **plan** (goal, pace,
target weight) computed from the profile, plus four new trackable domains — **workouts**,
**weights**, **habits** (cigarettes, water, coffee, alcohol, …) and a daily **diary** —
feeding one dashboard, reports, and export.

- Base path: `/api/v1`
- All bodies: JSON (`Content-Type: application/json`), except `GET /export.xlsx`.
- Auth: `Authorization: Bearer <jwt>` on every endpoint except `POST /auth/register`, `POST /auth/login`, `GET /health`.
- Timestamps in JSON: RFC3339 UTC strings (e.g. `"2026-07-02T14:30:00Z"`). Dates: `"YYYY-MM-DD"` (in the user's timezone).
- IDs: integers.
- In dev, the frontend reaches the API via Vite proxy (`/api` → `http://localhost:${BACKEND_PORT:-8080}`), so no CORS handling is required.
- Migration note: this is a dev-stage app. The backend may destructively migrate the
  `profiles` table (drop/recreate); `users`, `food_ref` and `food_logs` data must be preserved.

## Error shape (uniform)

Any non-2xx response:

```json
{ "error": { "code": "invalid_request", "message": "human-readable detail" } }
```

Codes: `invalid_request` (400), `invalid_credentials` (401), `unauthorized` (401 — missing/invalid/expired/revoked token),
`email_taken` (409), `not_found` (404), `internal` (500).

## Auth model (unchanged from v1)

- JWT HS256, expiry 7 days. Claims: `sub` (user id, string), `iat`, `exp`, `pwd_at` (unix seconds of `users.password_changed_at`).
- On every authenticated request the server loads the user and rejects with 401 `unauthorized`
  if `pwd_at` claim ≠ current `users.password_changed_at`. This is the sole revocation mechanism.
- Password rules: min 8 characters. Hashing: bcrypt (default cost).
- `timezone` must be a valid IANA name (validate with `time.LoadLocation`); default `"UTC"`.

## Shared object shapes

```jsonc
// User
{ "id": 1, "full_name": "Sara K", "email": "s@x.com", "timezone": "Asia/Tehran", "created_at": "2026-07-02T10:00:00Z" }

// Profile — every field nullable; PUT is a partial upsert (explicit null clears)
{ "birth_date": "2001-04-04", "sex": "female", "height_cm": 168, "weight_kg": 92,
  "activity_level": "moderate", "goal": "lose", "target_weight_kg": 85,
  "pace_kg_per_week": 0.5, "diet": "balanced", "updated_at": "..." }
// sex: "male" | "female" | "other"
// activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active"
//   (UI presents this as workouts/week: 0-2 → "light", 3-5 → "moderate", 6+ → "active")
// goal: "lose" | "maintain" | "gain"
// diet: "balanced" | "whole_food" | "mediterranean" | "flexitarian" | "pescatarian" | "vegetarian" | "vegan"

// Plan — derived, never stored. null targets until plan_complete (see Plan computation).
{
  "complete": true,
  "goal": "lose", "pace_kg_per_week": 0.5,
  "current_weight_kg": 92, "target_weight_kg": 85,
  "bmr": 1822, "tdee": 2824,
  "targets": Totals,                       // daily calorie + macro targets
  "projected_end_date": "2026-10-10"       // null for "maintain" or when target/pace missing
}

// Totals (calories + macros; also used for Targets, Averages, Remaining)
{ "calories": 1840, "protein_g": 120.5, "carbs_g": 190, "fat_g": 62 }

// FoodLog — unchanged from v1
{ "id": 10, "food_name": "Greek yogurt", "serving": "1 cup", "calories": 150, "protein_g": 20, "carbs_g": 8, "fat_g": 4,
  "logged_at": "2026-07-02T08:15:00Z", "created_at": "2026-07-02T08:15:30Z", "food_ref_id": 12 }

// Food / FoodServing — unchanged from v1
{ "id": 3, "label": "1 cup (245 g)", "grams": 245, "is_default": true }
{ "id": 12, "name": "Greek yogurt, plain, nonfat", "category": "Dairy", "is_custom": false,
  "nutrient_basis": "100g", "calories": 59, "protein_g": 10, "carbs_g": 3.6, "fat_g": 0.4,
  "is_favorite": true, "servings": [ /* FoodServing, default first */ ] }

// Workout — calories is always set in responses (client value or server estimate)
{ "id": 4, "activity": "running", "duration_min": 40, "intensity": "moderate",
  "calories": 420, "calories_estimated": true, "notes": "evening 5k",
  "logged_at": "2026-07-02T18:00:00Z", "created_at": "..." }
// activity: "walking" | "running" | "cycling" | "swimming" | "strength" | "yoga" | "hiit" | "sports" | "other"
// intensity: "low" | "moderate" | "high"

// WeightEntry
{ "id": 7, "weight_kg": 90.4, "measured_at": "2026-07-02T08:00:00Z", "created_at": "..." }

// Habit — kind presets fill name/unit/direction/daily_target defaults (see Habits)
{ "id": 2, "kind": "cigarette", "name": "Cigarettes", "unit": "cigarettes",
  "direction": "reduce", "daily_target": 5, "archived": false, "created_at": "..." }
// kind: "cigarette" | "water" | "coffee" | "alcohol" | "custom"
// direction: "reduce" (stay UNDER daily_target) | "build" (reach AT LEAST daily_target)
// daily_target: nullable positive integer

// HabitLog
{ "id": 31, "habit_id": 2, "count": 1, "logged_at": "2026-07-02T14:30:00Z", "created_at": "..." }

// DiaryEntry — exactly one per user per local day; all content fields nullable
{ "date": "2026-07-02", "mood": 4, "energy": 2, "text": "Slept badly, skipped gym.", "updated_at": "..." }
// mood, energy: integer 1–5

// Streak — current_days counts consecutive local days with ≥1 tracked item of ANY kind
// (food log, workout, habit log, or diary entry), ending today or yesterday
// (an unlogged "today" does not break the streak until the day is over).
{ "current_days": 4, "longest_days": 11 }
```

## Plan computation

`plan.complete` is true when the profile has ALL of: `birth_date`, `sex`, `height_cm`,
`weight_kg`, `activity_level`, `goal`. When incomplete, `plan.targets`, `bmr`, `tdee` are null.

- Age = whole years between `birth_date` and today in the user's timezone.
- BMR (Mifflin-St Jeor): male `10w + 6.25h − 5a + 5`; female `10w + 6.25h − 5a − 161`;
  other: midpoint `10w + 6.25h − 5a − 78`.
- TDEE = BMR × multiplier (sedentary 1.2, light 1.375, moderate 1.55, active 1.725, very_active 1.9).
- Daily calories = TDEE, then for `lose` subtract `pace × 7700 / 7`, for `gain` add it
  (pace defaults to 0.5 when null; clamp the result to ≥ 1200). `maintain` uses TDEE as-is.
- Macro targets: protein 30% ÷ 4 kcal/g, carbs 40% ÷ 4, fat 30% ÷ 9. Round everything to whole numbers.
- `projected_end_date` = today + `ceil(|weight_kg − target_weight_kg| / pace)` weeks
  (null when goal is `maintain`, or `target_weight_kg` is null).
- `current_weight_kg` mirrors `profile.weight_kg`; creating a WeightEntry updates it (see Weights).

## Endpoints

### GET /health
No auth. → 200 `{ "status": "ok" }`

### POST /auth/register
```jsonc
// req — timezone optional → "UTC"
{ "full_name": "Sara K", "email": "s@x.com", "password": "secret123", "timezone": "Asia/Tehran" }
// 201
{ "token": "<jwt>", "user": User }
```
Errors: 400 `invalid_request`, 409 `email_taken`. Email is normalized lowercase.

### POST /auth/login
`{ "email", "password" }` → 200 `{ "token", "user": User }`.
Errors: 401 `invalid_credentials` (same response for unknown email or wrong password).

### GET /me → 200 `User`
### PUT /me
`{ "full_name"?, "timezone"? }` (at least one) → 200 `User`.

### PUT /me/password
`{ "current_password", "new_password" }` → 200 `{ "token" }` (fresh token; all previous tokens revoked via `pwd_at`).
Errors: 401 `invalid_credentials`, 400 `invalid_request` (weak new password).

### GET /me/profile → 200 `Profile` (all-null fields if never set)

### PUT /me/profile
Any subset of Profile fields; explicit null clears a field. → 200 `Profile`
Validation (400 `invalid_request` otherwise): `birth_date` a valid date yielding age 10–120;
`weight_kg` and `target_weight_kg` 20–400; `height_cm` 90–250; `pace_kg_per_week` 0.1–1.5;
enums as listed. Setting `weight_kg` here does NOT create a WeightEntry.

### GET /me/plan → 200 `Plan`

### Foods (reference food database — unchanged from v1)

- `GET /foods?q=<text>&limit=20` — FTS5 instant search, prefix-tokenized, ranked
  whole-name prefix → relevance → popularity. `q` required non-empty; `limit` 1–50 default 20.
  → 200 `{ "foods": [Food, ...] }`
- `GET /foods/suggestions` → 200 `{ "recent": [≤8], "favorites": [≤12], "popular": [≤10] }`
- `GET /foods/{id}` → 200 `Food`; 404 if missing or another user's custom food.
- `POST /foods` `{ "name", "serving_label"?, "calories"?, "protein_g"?, "carbs_g"?, "fat_g"? }`
  → 201 `Food` (`is_custom: true`, `nutrient_basis: "serving"`, one serving with `grams: null`).
- `PUT /foods/{id}/favorite` → 204 (idempotent) · `DELETE /foods/{id}/favorite` → 204.

### Food logs (unchanged from v1)

- `POST /logs` — body as v1 (`food_name` required; nutrients ≥ 0; `logged_at` default now;
  optional `food_ref_id` provenance, 400 if not visible to caller). → 201 `FoodLog`.
  Logs store a **denormalized snapshot** computed client-side; the server never recomputes.
- `GET /logs?date=YYYY-MM-DD` | `GET /logs?from=&to=` — whole local days in the user's tz,
  `date` wins, default today. → 200 `{ "logs": [FoodLog, ...] }` ordered by `logged_at` asc.
- `PUT /logs/{id}` (partial; explicit `"food_ref_id": null` clears) → 200 `FoodLog` · `DELETE /logs/{id}` → 204.

### Workouts

#### POST /workouts
```jsonc
// req — activity required (enum above); duration_min required 1–1440; intensity optional (default "moderate");
// calories optional ≥ 0 (when omitted/null the server estimates — see below); notes optional ≤500 chars;
// logged_at optional (default now)
{ "activity": "running", "duration_min": 40, "intensity": "moderate", "notes": "evening 5k" }
// 201 → Workout (calories_estimated: true when the server estimated)
```
Calorie estimate: `MET × weight_kg × hours`, rounded, using profile `weight_kg` (70 when unset)
and intensity multiplier (low 0.85, moderate 1.0, high 1.15). MET by activity:
walking 3.5, running 9.0, cycling 7.0, swimming 7.0, strength 4.5, yoga 3.0, hiit 10.0, sports 8.0, other 5.0.
The estimate is computed once at write time and stored; later profile changes don't rewrite it.

#### GET /workouts?date=YYYY-MM-DD | ?from=&to=
Same date semantics as `/logs`. → 200 `{ "workouts": [Workout, ...] }` ordered by `logged_at` asc.

#### PUT /workouts/{id}
Partial update, same validation. Providing `"calories": null` re-estimates (with current profile weight).
→ 200 `Workout`. 404 if not owned. · `DELETE /workouts/{id}` → 204.

### Weights

- `POST /weights` `{ "weight_kg", "measured_at"? }` (20–400; default now) → 201 `WeightEntry`.
  Side effect: if this entry is the user's newest by `measured_at`, `profile.weight_kg` is set to it.
- `GET /weights?from=&to=` (both optional; default last 90 local days) → 200
  `{ "entries": [WeightEntry, ...] }` ordered by `measured_at` asc.
- `DELETE /weights/{id}` → 204. 404 if not owned. (No profile rollback on delete.)

### Habits

Presets applied at creation when fields are omitted:

| kind | name | unit | direction | daily_target |
|---|---|---|---|---|
| cigarette | Cigarettes | cigarettes | reduce | null |
| water | Water | glasses | build | 8 |
| coffee | Coffee | cups | reduce | null |
| alcohol | Alcohol | drinks | reduce | null |
| custom | (required) | times | build | null |

- `GET /habits?include_archived=false` → 200 `{ "habits": [Habit, ...] }` (creation order).
- `POST /habits` `{ "kind", "name"?, "unit"?, "direction"?, "daily_target"? }` → 201 `Habit`.
  400 when `kind: "custom"` without `name`. Duplicate non-custom kinds are allowed but the
  frontend should not create them.
- `PUT /habits/{id}` `{ "name"?, "unit"?, "direction"?, "daily_target"?, "archived"? }` → 200 `Habit`.
- `DELETE /habits/{id}` → 204 — archives (soft delete); logs are preserved. Idempotent.
- `POST /habits/{id}/logs` `{ "count"?, "logged_at"? }` (count default 1, range 1–100) → 201 `HabitLog`.
  404 if habit not owned (archived habits still accept logs — the UI just hides them).
- `GET /habits/{id}/logs?from=&to=` (default last 30 local days) → 200 `{ "logs": [HabitLog, ...] }` asc.
- `DELETE /habits/{id}/logs/{logId}` → 204 (the undo affordance). 404 if not owned.

### Diary

One entry per user per local day, keyed by date.

- `GET /diary?date=YYYY-MM-DD` (default today) → 200 `{ "entry": DiaryEntry | null }`
- `GET /diary?from=&to=` → 200 `{ "entries": [DiaryEntry, ...] }` ordered by date asc.
- `PUT /diary/{date}` `{ "mood"?, "energy"?, "text"? }` — upsert; at least one key required;
  explicit null clears a field. mood/energy 1–5; text ≤ 2000 chars (empty string = null).
  → 200 `DiaryEntry`. If the resulting entry has all three fields null it is deleted and the
  response is 204 instead.
- `DELETE /diary/{date}` → 204 (idempotent).

### GET /dashboard
One call for the home screen.
```jsonc
// 200
{
  "user": User,
  "plan": Plan,
  "today": {
    "date": "2026-07-02",
    "food": { "totals": Totals, "log_count": 3, "logs": [FoodLog, ...] },
    "burned_calories": 420,                 // sum of today's workout calories
    "workouts": [Workout, ...],
    "remaining": Totals | null,             // targets − food totals (calories may go negative); null when plan incomplete
    "habits": [ { "habit": Habit, "count": 3 }, ... ],  // non-archived habits with today's summed count
    "diary": DiaryEntry | null
  },
  "weight": {
    "current_kg": 90.4 | null,              // latest WeightEntry, else profile.weight_kg
    "start_kg": 92 | null,                  // earliest WeightEntry, else profile.weight_kg
    "target_kg": 85 | null
  },
  "streak": Streak
}
```

### GET /reports?period=daily|weekly|monthly&date=YYYY-MM-DD
`date` optional (default today, user tz). Boundaries in the user's tz: daily = that local day;
weekly = Monday–Sunday containing `date`; monthly = calendar month containing `date`.
```jsonc
// 200
{
  "period": "weekly", "start_date": "2026-06-29", "end_date": "2026-07-05", "timezone": "Asia/Tehran",
  "plan": Plan,
  "buckets": [ // one per day in range, zeros for empty days
    { "date": "2026-06-29", "totals": Totals, "log_count": 4,
      "burned_calories": 420, "workout_count": 1 }, ...
  ],
  "weights": [ { "date": "2026-06-29", "weight_kg": 91.2 }, ... ], // days with entries only (last of the day)
  "habits": [ // every non-archived habit, full day series (zeros for empty days)
    { "habit": Habit, "series": [ { "date": "2026-06-29", "count": 4 }, ... ] }, ...
  ],
  "averages": Totals | null,   // mean over days with ≥1 food log; null if none
  "deltas": {                  // (average − target) / target × 100; null when targets or averages null
    "calories_pct": -8.2, "protein_pct": -21.0, "carbs_pct": 4.5, "fat_pct": 12.3
  } | null,
  "streak": Streak
}
```

### GET /reports/insight?period=daily|weekly|monthly&date=YYYY-MM-DD
Synchronous AI insight over the same stats as `/reports` (now including workouts, weight trend
and habit adherence in the prompt). Response shape unchanged from v1:
```jsonc
{ "text": "...", "generated_by": "stub" /* | provider id */, "period": "weekly",
  "start_date": "2026-06-29", "end_date": "2026-07-05",
  "disclaimer": "These are general nutrition pattern observations, not medical advice or diagnosis. Consult a healthcare professional for medical guidance." }
```
The disclaimer string is constant and always present. Provider failures fall back to the stub
(never a 5xx for provider outages).

### GET /export.xlsx
→ 200, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
`Content-Disposition: attachment; filename="helsa-export.xlsx"`.
Five sheets, all of the caller's data oldest-first, timestamps in the user's tz (`YYYY-MM-DD HH:MM`):
- `Food Logs`: Logged At (local), Food, Serving, Calories, Protein (g), Carbs (g), Fat (g)
- `Workouts`: Logged At (local), Activity, Duration (min), Intensity, Calories, Estimated, Notes
- `Weights`: Measured At (local), Weight (kg)
- `Habits`: Date (local), Habit, Kind, Count, Unit
- `Diary`: Date, Mood (1-5), Energy (1-5), Text

Frontend fetches with the Bearer header and triggers a blob download.

## Backend config (env)

| Var | Default | Notes |
|---|---|---|
| `PORT` | `8080` | dev machines with 8080 taken run `PORT=8790` and set `BACKEND_PORT=8790` for the Vite proxy |
| `DB_PATH` | `./helsa.db` | SQLite file |
| `JWT_SECRET` | dev fallback + startup warning | required in prod |
| `OPENROUTER_API_KEY` | empty → stub provider | |
| `AI_MODEL` | `anthropic/claude-sonnet-5` | OpenRouter model id |
