# Helsa API Contract (v1) — OpenAPI-lite

This document is the single source of truth for the backend and frontend. Both are built
against it independently; do not deviate without updating this file.

- Base path: `/api/v1`
- All bodies: JSON (`Content-Type: application/json`), except `GET /export.xlsx`.
- Auth: `Authorization: Bearer <jwt>` on every endpoint except `POST /auth/register`, `POST /auth/login`, `GET /health`.
- Timestamps in JSON: RFC3339 UTC strings (e.g. `"2026-07-02T14:30:00Z"`). Dates: `"YYYY-MM-DD"` (in the user's timezone).
- IDs: integers.
- In dev, the frontend reaches the API via Vite proxy (`/api` → `http://localhost:8080`), so no CORS handling is required.

## Error shape (uniform)

Any non-2xx response:

```json
{ "error": { "code": "invalid_request", "message": "human-readable detail" } }
```

Codes: `invalid_request` (400), `invalid_credentials` (401), `unauthorized` (401 — missing/invalid/expired/revoked token),
`email_taken` (409), `not_found` (404), `internal` (500).

## Auth model

- JWT HS256, expiry 7 days. Claims: `sub` (user id, string), `iat`, `exp`, `pwd_at` (unix seconds of `users.password_changed_at`).
- On every authenticated request the server loads the user and rejects with 401 `unauthorized`
  if `pwd_at` claim ≠ current `users.password_changed_at`. This is the sole revocation mechanism.
- Password rules: min 8 characters. Hashing: bcrypt (default cost).
- `timezone` must be a valid IANA name (validate with `time.LoadLocation`); default `"UTC"`.

## Shared object shapes

```jsonc
// User
{ "id": 1, "full_name": "Sara K", "email": "s@x.com", "timezone": "Asia/Tehran", "created_at": "2026-07-02T10:00:00Z" }

// Profile — every biometric field is nullable; PUT is an upsert
{ "age": 27, "sex": "female", "weight_kg": 61.5, "height_cm": 168, "activity_level": "moderate", "updated_at": "..." }
// sex: "male" | "female" (null allowed). activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active" (null allowed)

// FoodLog
{ "id": 10, "food_name": "Greek yogurt", "serving": "1 cup", "calories": 150, "protein_g": 20, "carbs_g": 8, "fat_g": 4,
  "logged_at": "2026-07-02T08:15:00Z", "created_at": "2026-07-02T08:15:30Z" }

// Totals (also used for Targets and Averages)
{ "calories": 1840, "protein_g": 120.5, "carbs_g": 190, "fat_g": 62 }

// Streak
{ "current_days": 4, "longest_days": 11 }
// current_days counts consecutive local days with ≥1 log, ending today or yesterday
// (an unlogged "today" does not break the streak until the day is over).
```

**Targets** are `null` unless the profile has ALL of: age, sex, weight_kg, height_cm, activity_level.
When complete: Mifflin-St Jeor BMR (male `10w + 6.25h − 5a + 5`, female `10w + 6.25h − 5a − 161`)
× activity multiplier (sedentary 1.2, light 1.375, moderate 1.55, active 1.725, very_active 1.9) = TDEE calories.
Macro targets: protein 30% ÷ 4 kcal/g, carbs 40% ÷ 4, fat 30% ÷ 9. Round to whole numbers.

## Endpoints

### GET /health
No auth. → 200 `{ "status": "ok" }`

### POST /auth/register
```jsonc
// req
{ "full_name": "Sara K", "email": "s@x.com", "password": "secret123", "timezone": "Asia/Tehran" } // timezone optional → "UTC"
// 201
{ "token": "<jwt>", "user": User }
```
Errors: 400 `invalid_request` (missing/invalid fields, weak password, bad timezone), 409 `email_taken`. Email is normalized lowercase.

### POST /auth/login
```jsonc
// req
{ "email": "s@x.com", "password": "secret123" }
// 200
{ "token": "<jwt>", "user": User }
```
Errors: 401 `invalid_credentials` (same response for unknown email or wrong password).

### GET /me → 200 `User`

### PUT /me
```jsonc
// req — both optional, at least one required
{ "full_name": "Sara Khan", "timezone": "Europe/Berlin" }
// 200 → User
```

### PUT /me/password
```jsonc
// req
{ "current_password": "secret123", "new_password": "newsecret456" }
// 200
{ "token": "<jwt>" } // fresh token; all previously issued tokens are now revoked via pwd_at mismatch
```
Errors: 401 `invalid_credentials` (wrong current password), 400 `invalid_request` (weak new password).
Server sets `users.password_changed_at = now`.

### GET /me/profile → 200 `Profile` (all-null fields if never set)

### PUT /me/profile
```jsonc
// req — any subset; explicit null clears a field
{ "age": 27, "sex": "female", "weight_kg": 61.5, "height_cm": 168, "activity_level": "moderate" }
// 200 → Profile
```
Validation: age 10–120, weight_kg 20–400, height_cm 90–250, enums as above. 400 `invalid_request` otherwise.

### POST /logs
```jsonc
// req — logged_at optional (default: now). calories/macros ≥ 0; food_name required non-empty; serving free text (may be "")
{ "food_name": "Greek yogurt", "serving": "1 cup", "calories": 150, "protein_g": 20, "carbs_g": 8, "fat_g": 4,
  "logged_at": "2026-07-02T08:15:00Z" }
// 201 → FoodLog
```
Note (future seam): logs store a denormalized nutrient snapshot. A future seeded food-reference
table only pre-fills these values client-side; this endpoint's shape does not change.

### GET /logs?date=YYYY-MM-DD  |  GET /logs?from=YYYY-MM-DD&to=YYYY-MM-DD
Dates are interpreted in the **user's timezone** (whole local days, inclusive). `date` wins if both given; default: today.
```jsonc
// 200
{ "logs": [FoodLog, ...] } // ordered by logged_at ascending
```

### PUT /logs/{id}
Same body as POST (all fields optional; provided fields replace). → 200 `FoodLog`. 404 `not_found` if not owned by caller.

### DELETE /logs/{id} → 204. 404 `not_found` if not owned by caller.

### GET /dashboard
One call for the home screen.
```jsonc
// 200
{
  "user": User,
  "profile_complete": false,          // true when all 5 biometrics set
  "targets": Totals | null,
  "today": { "date": "2026-07-02", "totals": Totals, "log_count": 3, "logs": [FoodLog, ...] },
  "streak": Streak
}
```

### GET /reports?period=daily|weekly|monthly&date=YYYY-MM-DD
`date` optional (default: today in user tz). Period boundaries in the **user's timezone**:
daily = that local day; weekly = Monday–Sunday containing `date`; monthly = calendar month containing `date`.
```jsonc
// 200
{
  "period": "weekly",
  "start_date": "2026-06-29", "end_date": "2026-07-05", "timezone": "Asia/Tehran",
  "profile_complete": true,
  "targets": Totals | null,
  "buckets": [ { "date": "2026-06-29", "totals": Totals, "log_count": 4 }, ... ], // one per day in range, zeros for empty days
  "averages": Totals | null,          // mean over days that have ≥1 log; null if no logs in range
  "deltas": {                          // null when targets or averages are null
    "calories_pct": -8.2, "protein_pct": -21.0, "carbs_pct": 4.5, "fat_pct": 12.3
    // (average − target) / target × 100; negative = deficiency, positive = excess
  } | null,
  "streak": Streak
}
```

### GET /reports/insight?period=daily|weekly|monthly&date=YYYY-MM-DD
Synchronous AI insight over the same stats as `/reports`. May take a few seconds with a real provider.
```jsonc
// 200
{
  "text": "Your protein intake ran about 20% below target on 4 of 7 days...",
  "generated_by": "stub",             // "stub" | "openrouter" (provider id string)
  "period": "weekly", "start_date": "2026-06-29", "end_date": "2026-07-05",
  "disclaimer": "These are general nutrition pattern observations, not medical advice or diagnosis. Consult a healthcare professional for medical guidance."
}
```
The disclaimer string is constant and always present regardless of provider. If a remote provider
fails, the server falls back to the stub provider (never a 5xx for provider outages).

### GET /export.xlsx
→ 200, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
`Content-Disposition: attachment; filename="helsa-food-logs.xlsx"`.
One sheet `Food Logs`, header row: `Logged At (local)`, `Food`, `Serving`, `Calories`, `Protein (g)`, `Carbs (g)`, `Fat (g)`.
All of the caller's logs, oldest first, timestamps rendered in the user's timezone (`YYYY-MM-DD HH:MM`).
Frontend fetches with the Bearer header and triggers a blob download.

## Backend config (env)

| Var | Default | Notes |
|---|---|---|
| `PORT` | `8080` | |
| `DB_PATH` | `./helsa.db` | SQLite file |
| `JWT_SECRET` | dev fallback + startup warning | required in prod |
| `OPENROUTER_API_KEY` | empty → stub provider | |
| `AI_MODEL` | `anthropic/claude-sonnet-5` | OpenRouter model id |
