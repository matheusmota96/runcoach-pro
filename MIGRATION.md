# Migration: Railway -> Vercel + Neon Postgres

This branch refactors the backend from a long-running Express server to Vercel
serverless functions, with persistence in Neon Postgres (via Vercel's storage
integration).

The Express `server.js` is kept intact so Railway can keep running in parallel
during validation. Vercel ignores it (see `.vercelignore`).

## What changed

- `api/*.js` - serverless handlers (one per route)
- `lib/db.js` - Neon connection helper
- `lib/repo.js` - Postgres-backed repository (replaces JSON file)
- `lib/whatsapp.js`, `lib/messages.js`, `lib/http.js` - extracted helpers
- `sql/schema.sql` - Postgres schema (athlete, logs, meals, races, counters)
- `vercel.json` - Vercel config + cron schedules
- `.vercelignore` - excludes Railway-only files

## Endpoints (parity with the old Express app)

| Method | Path                      | Notes                          |
|--------|---------------------------|--------------------------------|
| GET    | `/api/data`               | Full state                     |
| POST   | `/api/sync`               | Bulk replace from client       |
| POST   | `/api/log`                | Create log                     |
| PUT    | `/api/log/:id`            | Update log                     |
| DELETE | `/api/log/:id`            | Delete log                     |
| POST   | `/api/meal`               | Create meal                    |
| PUT    | `/api/meal/:id`           | Update meal                    |
| DELETE | `/api/meal/:id`           | Delete meal                    |
| POST   | `/api/race`               | Create race                    |
| PUT    | `/api/race/:id`           | Update race                    |
| DELETE | `/api/race/:id`           | Delete race                    |
| GET    | `/api/plan`               | Week + phase context           |
| GET    | `/api/admin/migrate?key=` | One-shot import from Railway   |
| GET    | `/api/cron/morning`       | Vercel cron 07:00 BRT          |
| GET    | `/api/cron/evening`       | Vercel cron 21:00 BRT          |
| GET    | `/api/cron/weekly`        | Vercel cron Sunday 20:00 BRT   |
| POST   | `/api/webhook/evolution`  | Evolution API receiver         |
| POST   | `/api/webhook/twilio`     | Twilio receiver                |

## Required environment variables on Vercel

| Variable           | Source                                    |
|--------------------|-------------------------------------------|
| `DATABASE_URL`     | Auto-injected by Neon integration         |
| `MIGRATE_SECRET`   | Set manually (any random string)          |
| `CRON_SECRET`      | Optional - extra protection on cron URLs  |
| `WA_PROVIDER`      | `evolution` or `twilio`                   |
| `EVOLUTION_URL`    | If using Evolution                        |
| `EVOLUTION_API_KEY`| If using Evolution                        |
| `EVOLUTION_INSTANCE` | If using Evolution                      |
| `TWILIO_SID`       | If using Twilio                           |
| `TWILIO_TOKEN`     | If using Twilio                           |
| `TWILIO_FROM`      | If using Twilio                           |

## One-time data import

After the first deploy and after `MIGRATE_SECRET` is set, hit the URL once
from a phone browser:

```
https://runcoach-pro.vercel.app/api/admin/migrate?key=YOUR_MIGRATE_SECRET
```

Idempotent: subsequent calls are blocked by the `migration_marker` row.

To re-run after a mistake, in the Neon SQL console:
```sql
TRUNCATE logs, meals, races, athlete RESTART IDENTITY CASCADE;
DELETE FROM migration_marker;
```

Then call the endpoint again.

## Cron schedules (UTC, set in vercel.json)

| Path                  | UTC cron      | Local time (BRT, UTC-3) |
|-----------------------|---------------|--------------------------|
| `/api/cron/morning`   | `0 10 * * *`  | 07:00 daily              |
| `/api/cron/evening`   | `0 0 * * *`   | 21:00 daily              |
| `/api/cron/weekly`    | `0 23 * * 0`  | 20:00 Sunday             |
