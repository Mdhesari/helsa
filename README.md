# Helsa

Mobile-first diet-tracking MVP. Log food manually, see timezone-aware nutrition reports
against personalized targets (Mifflin-St Jeor → TDEE, 30/40/30 macros), keep a logging
streak, and get AI-generated pattern insights (general observations only — never medical
advice).

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind v4 — [`frontend/`](frontend/)
- **Backend**: Go (stdlib `net/http`), SQLite (modernc, CGO-free) — [`backend/`](backend/)
- **Contract**: [`docs/api-contract.md`](docs/api-contract.md) — single source of truth for the API
- **Design**: tokens + mascot SVGs — [`design/`](design/)

## Run (dev)

```sh
# backend — :8080
cd backend && go run ./cmd/server

# frontend — :5173, proxies /api → :8080
cd frontend && npm install && npm run dev
```

## Config (env, backend)

| Var | Default | Notes |
|---|---|---|
| `PORT` | `8080` | |
| `DB_PATH` | `./helsa.db` | SQLite file |
| `JWT_SECRET` | insecure dev fallback | set in prod |
| `OPENROUTER_API_KEY` | empty → deterministic stub insights | |
| `AI_MODEL` | `anthropic/claude-sonnet-5` | OpenRouter model id |

## Architecture notes

- **Auth**: 7-day HS256 JWT with a `pwd_at` claim checked against `users.password_changed_at`
  on every request — changing the password revokes all outstanding tokens. No refresh flow (MVP).
- **Future seams**: food logs store denormalized nutrient snapshots, so a seeded food-reference
  table later only pre-fills the form; AI insights sit behind a `Provider` interface
  (stub / OpenRouter / anything OpenAI-compatible); clinical-grade review can slot in behind
  the same report-stats pipeline.
- **Deferred**: account deletion, refresh tokens, food-reference table, async insight caching.
