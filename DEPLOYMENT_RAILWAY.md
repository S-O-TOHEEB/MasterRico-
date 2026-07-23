# EduStream — Railway Deployment Guide

Railway equivalent of `render.yaml`. This app is four services, not one —
Postgres, Redis, the `ai_service` (Python/FastAPI), and the `backend`
(Node/Express) — and all four need to exist for the app to be fully
functional. You *can* deploy just `backend` + Postgres on their own (the app
boots fine and most features work — Redis and `ai_service` both degrade
gracefully when unreachable, same as every other optional integration in
this codebase), but AI lesson summaries and course auto-tagging won't work
without `ai_service`, and background jobs won't run without Redis.

Railway doesn't consume `render.yaml` directly — there's no single-file
blueprint for a project this shape yet, so this is a manual walkthrough,
same structure as `render.yaml`'s four services.

## 1. Create the project and add infrastructure

```bash
railway login
railway init
```

Then add both data stores — dashboard (**+ New** → Database) or CLI:

```bash
railway add -d postgres
railway add -d redis
```

Both expose connection-string variables automatically
(`DATABASE_URL` for Postgres, `REDIS_URL` for Redis) — this backend already
prefers those over the individual host/port/user vars when they're present
(see `backend/src/config/database.ts` and `backend/src/utils/queue.ts`), so
no manual field-by-field mapping is needed, same as the Render setup.

## 2. Deploy `ai_service` first

**Dashboard:** **+ New** → **GitHub Repo** → this repo → set **Root Directory**
to `ai_service` in the service's Settings
**CLI:** `railway up --path-as-root ai_service` from the repo root, or `cd ai_service && railway up`

Railway auto-detects `ai_service/Dockerfile`. One thing to fix before/after
first deploy: that Dockerfile's `CMD` hardcodes `--port 8000`, but Railway
(like Render) injects its own dynamic `$PORT`. In the service's Settings →
Deploy, **override the start command** to:

```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

(`render.yaml` handles this the same way — its `startCommand` overrides the
Dockerfile's `CMD` rather than editing the Dockerfile itself.)

**Variables** for this service:
- `PYTHON_VERSION` — pin explicitly (the Dockerfile uses `python:3.12-slim`;
  match that rather than trusting Railway's native-runtime default, which
  drifts over time)
- `OPENAI_API_KEY`
- `INTERNAL_API_KEY` — any random string; you'll set the same value as
  `AI_INTERNAL_API_KEY` on the backend service in step 4

Generate a domain for it (Settings → Networking → **Generate Domain**) and
copy the URL — you need it in step 4.

## 3. Deploy the backend

**Dashboard:** **+ New** → **GitHub Repo** → this repo → set **Root Directory** to `backend`
**CLI:** `cd backend && railway up`

Railway auto-detects `backend/Dockerfile`.

**One thing worth fixing regardless of which platform you deploy to:**
`backend/Dockerfile` is currently pinned to `node:20-alpine`. Node 20 went
end-of-life April 2026 — no further security patches. `render.yaml` already
made the same call for its own runtime pin (Node 22.22.3, LTS through April
2027); worth updating the Dockerfile itself to `node:22-alpine` rather than
just overriding it per-platform, so local Docker builds and every deploy
target stay consistent.

## 4. Wire the variables together

On the **backend** service:

- Reference `DATABASE_URL` from the Postgres service (Variables tab → **Add Reference Variable**)
- Reference `REDIS_URL` from the Redis service, same way
- `JWT_SECRET` — required, real random value (`openssl rand -hex 32`)
- `AI_SERVICE_URL` — the `ai_service` domain from step 2
- `AI_INTERNAL_API_KEY` — must match `INTERNAL_API_KEY` you set on `ai_service`
- `NODE_ENV=production`
- `TYPEORM_SYNC=true` for the first deploy (flip to `false` once the schema is stable)
- Everything else from `backend/.env.example` that you're actually using —
  Stripe, Paystack, storage provider, Mux, LiveKit, Brevo. All of these are
  feature-gated (missing = that feature logs a warning and fails cleanly,
  not a boot failure), so only fill in what you need live now.

Generate a domain for the backend too, then register webhooks:

| Provider | URL |
|---|---|
| Stripe | `https://<backend-domain>/api/v1/webhooks/stripe` |
| Paystack | `https://<backend-domain>/api/v1/webhooks/paystack` |
| Mux | `https://<backend-domain>/api/v1/webhooks/mux` |

## 5. Spending limit

Railway bills by actual usage with no default cap — running four services
adds up faster than one. Set a limit under Settings → Usage before you
forget.

---

## Things I noticed while writing this, not directly asked for

Flagging these rather than silently fixing them, since none were part of
what was asked:

1. **`render.yaml` references `SENDGRID_API_KEY`**, but the actual
   `EmailService.ts` sends through Brevo SMTP (`BREVO_SMTP_USER`/`BREVO_SMTP_PASS`).
   That variable in `render.yaml` does nothing — worth removing or swapping.
2. **`render.yaml` predates several later features** — no `MUX_WEBHOOK_SECRET`,
   `LIVEKIT_*`, `CLOUDINARY_*`, or `STORAGE_PROVIDER`, so a Render deploy from
   that file as-is would boot fine but silently skip video, live sessions,
   and cloud file storage until those are added manually in the dashboard.
3. **Two leftover files inside `backend/`** worth cleaning up: `PATCH_NOTES.md`
   (superseded by `CHANGELOG.md`, but not automatically deleted when the
   updated docs were extracted alongside it) and `EduStream_Backend_Documented.zip`
   (the delivered zip itself, sitting redundantly inside its own extracted contents).

Want me to bring `render.yaml`, `docker-compose.yml`, and the Dockerfiles up
to date with all of this in one pass?
