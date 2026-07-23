# Deployment

Written for [Render](https://render.com), since that's what `.env.example`
and the existing setup assume — but the `Dockerfile` is standard multi-stage
Node and will run on any container platform (Fly.io, Railway, ECS, etc.)
with the same environment variables.

## 1. Database

Provision a managed Postgres instance. Grab the connection details for
`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`.

## 2. Required environment variables

The app **will not boot** without a real `JWT_SECRET` — this is enforced at
startup (`src/config/env.ts`), not just recommended. Generate one with:

```bash
openssl rand -hex 32
```

Everything else in `.env.example` is feature-gated: leave a section blank
and that specific feature logs a warning and fails cleanly when used,
without taking down the rest of the app. Fill in only what you're actually
using for this deploy — see the table in [`README.md`](../README.md#environment-variables).

## 3. Schema

First deploy: leave `TYPEORM_SYNC=true` (the default). TypeORM creates every
table from the entity definitions on boot — no migration files needed for a
fresh database.

Once you have real data you care about, generate a migration and switch to
`TYPEORM_SYNC=false`:

```bash
npm run migration:generate   # run locally, pointed at the Render DB
npm run migration:run        # apply it
```

**One specific gotcha:** this backend uses several Postgres enum columns
(`payments.status`, `corporate_accounts.status`, `media.status`, etc.).
`TYPEORM_SYNC=true` handles *adding* new enum values fine on a fresh table,
but altering an enum type on a table that already has production data is one
of the few things TypeORM sync sometimes needs a manual nudge on. If a
deploy adds a new status value to an existing enum column and the app fails
to boot with an enum-related Postgres error, check the column's actual type
in the DB against the entity definition.

## 4. Third-party webhook endpoints

Once deployed, register these URLs with each provider's dashboard:

| Provider | Webhook URL | Events |
|---|---|---|
| Stripe | `https://your-api.com/api/v1/webhooks/stripe` | `payment_intent.succeeded`, `payment_intent.payment_failed` |
| Paystack | `https://your-api.com/api/v1/webhooks/paystack` | `charge.success`, `charge.failed` |
| Mux | `https://your-api.com/api/v1/webhooks/mux` | `video.asset.ready`, `video.asset.errored` |

Each provider gives you a signing secret when you register the endpoint —
that's `STRIPE_WEBHOOK_SECRET`, `MUX_WEBHOOK_SECRET`. Paystack verification
uses the same `PAYSTACK_SECRET_KEY` you already have (HMAC over the request
body, no separate webhook secret).

**Don't skip this step and assume payments "just work"** — without a
registered webhook, a payment can succeed on the gateway's side and the
learner's enrollment/subscription/etc. will never actually activate, since
that only happens when the webhook fires.

## 5. File/video storage

Pick one and set `STORAGE_PROVIDER` accordingly:

- **`s3`** (recommended for production) — needs `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`. Optionally
  `AWS_CLOUDFRONT_URL` to serve through a CDN instead of raw S3 URLs.
- **`cloudinary`** — needs `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET`.
- **`local`** — do not use this on Render for anything you care about
  keeping. The filesystem is ephemeral across redeploys/restarts unless you
  attach a persistent disk, and even then it won't survive a full instance
  replacement. Fine for local development only.

Video (Mux) is independent of this setting — always configure
`MUX_TOKEN_ID`/`MUX_TOKEN_SECRET`/`MUX_WEBHOOK_SECRET` separately if you
support video uploads at all.

## 6. Health checks

`GET /health` returns `{ status: "ok", ... }` — point your platform's health
check at this. The `Dockerfile` already has one configured for Docker-based
deploys.

## 7. Pre-deploy checklist

- [ ] `JWT_SECRET` set to a real random value (not the `.env.example` placeholder)
- [ ] Database reachable, `TYPEORM_SYNC` set intentionally (not left on `true` forever)
- [ ] At minimum one payment gateway configured, with its webhook registered
- [ ] `STORAGE_PROVIDER` set to `s3` or `cloudinary`, not `local`
- [ ] `CORS_ORIGINS` set to your actual frontend domain(s), not left as `*`
- [ ] `FRONTEND_URL` set correctly (used to build Stripe Connect onboarding return URLs)
- [ ] `BREVO_SMTP_USER`/`BREVO_SMTP_PASS` set if you need real emails to send (OTP, password reset, notifications)
