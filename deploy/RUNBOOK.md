# Crumb production deployment runbook

Single-VPS deployment: Next.js standalone image + Postgres 16 container, Docker Compose.
Validated 2026-09-02 against an emulated production stack (fresh Postgres container,
`migrate deploy` from host, slim runner image, health + route probes).

## Architecture

```
Internet ── Caddy (HTTPS, recommended) ── :3000 web (crumb:app)
                                             │
Postgres container (crumb_postgres, crumb_pgdata volume)
```

- **web image**: `node:20-alpine`, Next standalone output + `@prisma/client` runtime
  only. No prisma CLI, no source, no build deps.
- **Migrations run from the HOST at deploy time**, never at container boot (the slim
  runner deliberately omits the prisma CLI + schema engine).
- **Seed runs once from the HOST** (`npx tsx prisma/seed.ts`). It is destructive —
  it `deleteMany()`s and recreates demo data. Run it only on first deployment.

## Prerequisites

- Docker 20.10+ with Compose v2, on the VPS.
- A domain (A record → VPS IP) if you want a real hostname.
- Mailgun account with a verified sending domain (or swap the mailer in `lib/auth.ts`).

## Environment

Copy `.env.example` to `.env` on the server and fill in:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `postgresql://crumb:crumb@db:5432/crumb` when run by compose web; host-side commands use `127.0.0.1:5432`. |
| `BETTER_AUTH_SECRET` | Generate: `openssl rand -base64 32`. Required for signing sessions. |
| `BETTER_AUTH_URL` | Public origin, e.g. `https://app.yourdomain.com`. No trailing slash. |
| `NEXT_PUBLIC_APP_URL` | Same as `BETTER_AUTH_URL` (no trailing slash). Inlined at **build** time into the client bundle — must be set via `--build-arg`/compose `build.args`. |
| `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL` | Sending domain from Mailgun. |
| `PLATFORM_ADMIN_EMAILS` | Comma-separated emails allowed into `/admin`. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Default `crumb`/`crumb`/`crumb`; override for prod. |
| `PORT` / `WEB_PORT` | Container listens on 3000; `WEB_PORT` is the host mapping. |

## First deployment

```bash
git pull
cp .env.example .env            # fill in values (above)
docker compose up -d db         # start Postgres, wait until healthy
npm ci --legacy-peer-deps       # host tools (prisma CLI, tsx) for migrate + seed
npm run db:deploy               # prisma migrate deploy against the container DB
npm run db:seed                 # ONCE ONLY — wipes + recreates demo data
docker compose up -d --build web
```

`docker compose build` passes `NEXT_PUBLIC_APP_URL` from `.env` as a build arg
(`build.args.NEXT_PUBLIC_APP_URL`); a bare `docker build` needs
`--build-arg NEXT_PUBLIC_APP_URL=https://app.yourdomain.com`.

Verify: `curl -I https://app.yourdomain.com/sign-in` → 200, then sign in with the
seeded `owner@crumb.mv` (OTP email arrives from Mailgun).

## HTTPS (recommended)

Put Caddy in front instead of exposing 3000 directly:

```caddyfile
app.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}
```

Better Auth marks cookies `Secure` when `BETTER_AUTH_URL` is HTTPS; it must match the
scheme+host the browser sees. (compose exposes `${WEB_PORT:-3000}:3000` on all
interfaces today — restrict with `127.0.0.1:` in ports when adding a reverse proxy.)

## Upgrades

```bash
git pull
npm ci --legacy-peer-deps
npm run db:deploy              # schema first — it is safe to run before/after, never during
docker compose up -d --build web
```

Migrations are forward-only. If an app version needs a migration you haven't applied,
`migrate deploy` errors informatively (`P3014`); apply and re-run compose.

## Backups

```bash
docker compose exec db pg_dump -U crumb -d crumb | gzip > crumb-$(date +%F).sql.gz
```

Restore:

```bash
gunzip -c crumb-2026-09-02.sql.gz | docker compose exec -T db psql -U crumb -d crumb
```

Store off-host (object storage). Test restores periodically.

## Rollback

Compose only tracks `latest`; tag images explicitly for rollback-capable deploys:

```bash
docker build --build-arg NEXT_PUBLIC_APP_URL=https://app.yourdomain.com -t crumb:app-$(date +%s) .
# keep the last tag around, then on rollback:
docker tag crumb:app-<old> crumb:app && docker compose up -d web
```

Schema rollback is not automatic (forward-only migrations). For data-affecting schema
changes, restore the backup from before deploy.

## Day-to-day ops

```bash
docker compose logs -f web          # app logs / OTP errors
docker compose ps                   # health: web should be "healthy"
docker compose restart web
```

## Troubleshooting

- **`session` is null / OTP never arrives**: check Mailgun env in `.env`, and that
  `BETTER_AUTH_URL` matches the domain (OTP emails link back to it).
- **Pages redirect back to `/sign-in` after login**: `BETTER_AUTH_URL` mismatch or
  missing cookie-prefix on the proxy (proxy handles this via `cookiePrefix: 'crumb'`).
- **Client hits `localhost:3000` in the browser**: `NEXT_PUBLIC_APP_URL` was not set
  as a build arg — rebuild with it.
- **`Error: P2021` (table missing)**: migrations not applied — run `npm run db:deploy`.

## Security notes

- HTTPS in front (`Secure` cookies), restrict the compose port to `127.0.0.1:3000`.
- Rotate `BETTER_AUTH_SECRET` and Postgres password out of band.
- `/admin` is guarded by the `PLATFORM_ADMIN_EMAILS` allowlist only — keep it to
  operators.