# EduStream Backend

Node.js/Express/TypeORM backend for EduStream, an e-learning platform: courses,
live sessions, corporate accounts, creator payouts, and a Postgres-backed API
with real integrations for payments (Stripe, Paystack), file/video storage
(S3, Cloudinary, Mux), and live video (LiveKit).

**170 endpoints across 29 route files.** See [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md)
for the full map, or run the server and visit `/docs` for interactive Swagger UI.

## Tech stack

- **Runtime:** Node.js 20, TypeScript (strict mode)
- **Framework:** Express 4
- **Database:** PostgreSQL via TypeORM
- **Auth:** JWT (access tokens), bcrypt password hashing
- **Payments:** Stripe + Paystack, routed automatically by currency
- **Storage:** S3, Cloudinary, or local disk (env-selected)
- **Video:** Mux (direct upload + webhook-driven processing)
- **Live sessions:** LiveKit (real-time rooms + per-participant tokens)
- **Email:** Brevo (SMTP)
- **Background jobs:** BullMQ (Redis-backed)

## Quick start

```bash
git clone <repo-url>
cd backend
npm install
cp .env.example .env
# edit .env — see "Environment variables" below for what's actually required
npm run dev
```

The server starts on `http://localhost:3000` by default. Health check:
`GET /health`. Interactive API docs: `GET /docs`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run the compiled build (`dist/index.js`) |
| `npm run typecheck` | Type-check without emitting output |
| `npm run migration:generate` | Generate a TypeORM migration from entity changes |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Roll back the last migration |
| `npm run migration:show` | List migration status |

There is currently no automated test suite in this repo — validation has been
manual (typecheck + build + targeted integration tests during development).
Worth adding before this goes further into production use; see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the areas most worth
covering first (payment webhook idempotency, capacity race conditions).

## Environment variables

Full list with comments in [`.env.example`](.env.example). The short version:

**Always required:**
- `JWT_SECRET` — the server refuses to boot without a real one (see
  `src/config/env.ts`); generate with `openssl rand -hex 32`
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` — Postgres connection

**Required per feature you actually use** (each degrades gracefully — logs a
clear warning and fails only that feature — if left unset, rather than
crashing the app):

| Feature | Env vars |
|---|---|
| Card payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| African payments | `PAYSTACK_SECRET_KEY` |
| Creator payouts | `STRIPE_SECRET_KEY` (same key, different Stripe product — Connect) |
| File storage | `STORAGE_PROVIDER` (`s3` \| `cloudinary` \| `local`) + matching credentials |
| Video upload | `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET` |
| Live sessions | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` |
| Transactional email | `BREVO_SMTP_USER`, `BREVO_SMTP_PASS` |
| AI lesson summaries | `AI_SERVICE_URL`, `AI_INTERNAL_API_KEY` (points at the separate FastAPI microservice — not part of this repo) |

## Project structure

```
src/
├── config/        # DataSource setup, env validation
├── controllers/   # Request handlers — thin, delegate to services
├── entities/      # TypeORM entities (26 files, ~30 tables)
├── middlewares/    # auth, safeRouter, rate limiting, upload, error handling
├── routes/        # Route definitions, one file per feature area
├── services/      # Business logic — this is where the real work happens
│   └── payments/  # Gateway abstraction (Stripe, Paystack) + orchestrator
├── types/         # Ambient type declarations
└── utils/         # Shared helpers (pagination, params, logger, queue)
```

## Key design points

A few things that aren't obvious from the code alone — see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full explanation of
each:

- **Every payment flow shares one gateway orchestrator** that auto-records a
  ledger row (`GET /payments`, `/payments/my`, admin refund/status endpoints)
  — course purchases, subscriptions, corporate accounts, and verified
  certificates all go through the same code path.
- **Video processing is entirely webhook-driven**, not polled: browser →
  Mux direct upload (TUS) → Mux transcodes → Mux webhook → this backend marks
  the record `READY` → frontend picks it up next time it reads the record.
- **Every route goes through `safeRouter`** (`src/utils/safeRouter.ts`), a
  drop-in replacement for `express.Router()` that catches async
  handler/middleware rejections and forwards them to the error handler —
  Express 4 doesn't do this automatically, unlike Express 5.
- **Content moderation is instant-hide, not threshold-based**: one report
  hides a post/reply/review immediately pending admin review, rate-limited
  to 10 reports/hour per user to bound abuse of that power.

## API documentation

Three ways to explore the API, in order of how current they are:

1. **`GET /docs`** — live Swagger UI generated from the running server
2. **[`docs/API_REFERENCE.md`](docs/API_REFERENCE.md)** — endpoint map by feature area with auth requirements
3. A Postman collection covering the payments/storage/video/messaging endpoints (ask for it if you don't have a copy — not checked into this repo)

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full checklist
(currently written for Render, but the Dockerfile works anywhere that runs
containers).
