# PWA & offline architecture

Helsa installs to the home screen and keeps working without a connection. This
documents how, and the constraints that shaped it.

## Install

`frontend/public/manifest.webmanifest` (standalone, portrait, `/app` start URL)
plus the iOS meta tags in `frontend/index.html`. iOS ignores the manifest's
`display`, so `apple-mobile-web-app-capable` is what actually makes the app
launch chromeless; `apple-touch-icon.png` is opaque because iOS renders alpha
as black.

Icons are generated from two SVG sources in `frontend/public/icons/`:

- `icon-maskable.svg` — mark at 70% scale for Android's circular/squircle crop
- `icon-any.svg` — full-bleed, also the iOS home-screen and App Store icon

Regenerate after a logo change:

```bash
cd frontend/public/icons && for s in 192 512; do rsvg-convert -w $s -h $s icon-maskable.svg -o icon-maskable-$s.png; rsvg-convert -w $s -h $s icon-any.svg -o icon-$s.png; done && rsvg-convert -w 180 -h 180 -b '#58cc02' icon-any.svg -o apple-touch-icon.png
```

## Service worker

`vite-plugin-pwa` in `generateSW` mode precaches the shell (JS/CSS/HTML/icons)
with an `index.html` navigation fallback so client-side routes resolve offline.
`/api` is excluded from the fallback: API calls must fail as API calls rather
than being answered with the HTML shell.

`registerType: 'prompt'` — a new build waits until the user taps **Refresh**
(`components/UpdatePrompt.tsx`). Auto-reloading would discard a half-typed
entry. `lib/sw.ts` re-checks for updates on `visibilitychange`, because iOS
keeps PWAs suspended for days and a resumed app can otherwise sit on a very old
shell.

**The API is deliberately not runtime-cached.** Cache API entries survive
logout, so caching authenticated responses would leak one account's food logs
to the next person using the device. Offline reads come from the react-query
cache instead, which logout wipes.

## Offline reads

`lib/persist.ts` persists the react-query cache to IndexedDB (`gcTime` and
`maxAge` both 7 days). Dashboard, logs and reports render from last-known data
on a cold offline start. Only `status === 'success'` queries are persisted, so
a stale error never restores as a broken screen.

Cleared on logout **and** on token expiry/revocation — `api/client.ts` calls the
handler registered by `AuthContext` when a 401 clears the session.

## Offline writes — the outbox

`lib/outbox.ts` queues writes in IndexedDB when there is no connection.
`lib/useOfflineWrite.ts` holds the shared "send now or queue durably" decision;
each caller supplies how to perform the write online plus the payload to queue
if it cannot.

Queueable today (`OutboxPayload`):

| Kind | Written from | Optimistic feedback |
|---|---|---|
| `log`, `custom-food` | Log food | appears in today's list, marked *Waiting to sync* |
| `workout` | Workout sheet | toast; calories are filled in by the server on sync |
| `weight` | Weight sheet | toast |
| `habit-log` | Dashboard habit chip | count bumps immediately |

Structural writes — creating a habit, editing the plan, registering — are
deliberately **not** queued: they are rare, need server-assigned ids, and a
stale replay of them is worse than an honest error.

The diary is a `PUT` upsert keyed on `(user, date)`, so it is already idempotent
by construction and needs no `client_key`; it is not queued today.

Queued food logs show with edit/delete disabled, since they have no server id
until they sync.

Replay happens on reconnect, on return to the foreground, and at startup
(`lib/useOutbox.ts`) — iOS fires neither `online` nor `visibilitychange`
reliably when a suspended PWA resumes, so all three are wired.

Two decisions worth keeping:

- **`networkMode: 'always'` on mutations** (`main.tsx`). React Query otherwise
  *pauses* mutations while offline and never calls `mutationFn`, which would
  bypass the outbox entirely — and its own paused queue is in-memory, so iOS
  discards it when it evicts the tab. Queries keep the default, which correctly
  serves persisted cache offline.
- **Server-side idempotency.** Every queued write carries a `client_key` UUID
  (the outbox entry id) and the server treats it as unique per owner. A retry
  after a lost response returns the original row (200) instead of creating a
  duplicate — without this, flaky mobile networks would silently inflate
  calorie totals, burned calories and habit counts. Implemented for
  `/logs`, `/workouts`, `/weights` and `/habits/{id}/logs`; the shared helpers
  live in `backend/internal/api/idempotency.go`. Habit logs scope the key by
  `habit_id`, since that table has no `user_id`. Covered by
  `TestCreateLogClientKeyIsIdempotent` and
  `TestCreateClientKeyIsIdempotentAcrossKinds`.

Entries that fail permanently (4xx other than 401/408/429) are dropped rather
than retried forever, since they would block everything queued behind them.

## Deploy notes

`devops/nginx.conf` must keep serving `sw.js` and `index.html` with
`Cache-Control: no-cache`. A cached `sw.js` pins users to an old build with no
way to update — that is the one caching mistake with no client-side recovery.
