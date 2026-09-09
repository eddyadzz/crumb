# Crumb — From Recipe to Profit

Production and profitability platform for home bakers, cottage food operators,
and small food businesses. Built by [BoliFlow](https://github.com/eddyadzz).

## What it does

- **Orders** — manual + REST API intake, status flow, delivery scheduling
- **Order portal** — shareable public page where customers submit orders
- **Status tracking** — per-order public timeline (`/status/{token}`)
- **Planning** — schedule (day/week/month), ingredient forecast, self-filling shopping list with print sheet
- **Production** — planning queue, touch-first Floor Mode for baking day, offline outbox with a Sync Center
- **Cost control** — recipe costing, planned-vs-actual variance, efficiency metrics, pricing assistant with suggested shelf prices
- **Adoption** — setup checklist, sample bakery, daily order reminders, feedback capture routed to `/admin`

## Stack

- Next.js (App Router, standalone output) · React 19
- Postgres + Prisma · Better Auth · Tailwind CSS · Recharts
- Vitest for unit tests (`npm test`), ESLint (`npm run lint`)

## Quickstart (development)

```bash
npm ci --legacy-peer-deps
cp .env.example .env     # fill in DATABASE_URL, BETTER_AUTH_*
npm run db:migrate       # or: npx prisma migrate deploy
npm run db:generate
npm run db:seed          # optional demo data (destructive)
npm run dev              # http://localhost:3000
```

## Deployment

See [`deploy/RUNBOOK.md`](deploy/RUNBOOK.md):
- Docker Compose path (Postgres container + slim standalone image) — includes
  first-deploy, migration, backup, rollback, and HTTPS reverse-proxy guidance.
- Bare-metal path via `deploy/crumb.service` (systemd unit).

## Cron endpoints (bearer-gated)

| Endpoint | Purpose | Token |
|---|---|---|
| `POST /api/cron/trial-emails` | Trial lifecycle emails | `CRON_TRIAL_SECRET` |
| `POST /api/cron/order-reminders` | Daily morning briefing | `CRON_REMINDERS_SECRET` |

Both are idempotent. Point any scheduler (systemd timer, host crontab, or an
HTTP cron service) at them with `Authorization: Bearer <token>`.
