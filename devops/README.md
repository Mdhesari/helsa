# Helsa — production Docker Compose

Two containers: `backend` (Go API, internal-only) and `frontend` (nginx serving
the built SPA and reverse-proxying `/api` to the backend). SQLite data persists
on the named volume `helsa-data`.

## Run

```sh
cd devops
cp .env.example .env      # then set JWT_SECRET (openssl rand -hex 32)
docker compose up -d --build
```

App: http://localhost:3000 (change with `HELSA_HTTP_PORT` in `.env`).
The backend publishes no host ports; only nginx is exposed.

## Behind an existing Traefik

If you already run Traefik, layer the override instead of publishing a port
(set `HELSA_DOMAIN` — and `TRAEFIK_NETWORK` / `TRAEFIK_ENTRYPOINT` /
`TRAEFIK_CERT_RESOLVER` if yours differ from the defaults — in `.env`):

```sh
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
```

Traefik itself is not included; the override only attaches the frontend to the
external `traefik` network and adds router labels. The external network must
already exist.

## Data & backups

The SQLite file lives at `/data/helsa.db` inside the backend container, on the
`helsa-data` volume (`helsa_helsa-data` on the host).

Back up (writes `helsa.db` to the current directory):

```sh
docker compose stop backend
docker run --rm -v helsa_helsa-data:/data -v "$PWD":/backup alpine:3.21 \
  cp /data/helsa.db /backup/helsa.db
docker compose start backend
```

Restore: same command with `cp /backup/helsa.db /data/helsa.db`.
Stopping the backend first avoids copying a mid-write database.

## Operations

```sh
docker compose ps                  # health status of both services
docker compose logs -f backend     # backend logs
docker compose up -d --build       # redeploy after code changes
docker compose down                # stop (data survives)
docker compose down -v             # stop AND DELETE the database volume
```

## Notes

- `JWT_SECRET` is enforced at compose level (`${JWT_SECRET:?}`) because the app
  otherwise falls back to an insecure dev secret.
- Leave `OPENROUTER_API_KEY` empty to use the stub insights provider.
- Health checks hit the backend's `GET /api/v1/health` endpoint.
- Build contexts are the repo root; `Dockerfile.*.dockerignore` files (BuildKit,
  default since Docker 23) keep contexts small. Both runtime containers run as
  non-root users.
