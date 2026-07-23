# EduStream Backend v2

Video-first structured learning platform — backend services.

## Architecture

```
edustream_v2/
├── backend/           Node 20 + Express + TypeORM + PostgreSQL + BullMQ
├── ai_service/        Python 3.11 + FastAPI + OpenAI
├── docker-compose.yml Local dev stack (postgres + redis + both services)
└── render.yaml        Render IaC — one-click deploy
```

## Quick start (local)

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker + Docker Compose (for postgres + redis)
- PostgreSQL client (`psql`) — optional, for manual queries

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd edustream_v2

# Backend env
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum set JWT_SECRET

# AI service env
cp ai_service/.env.example ai_service/.env
# Edit ai_service/.env — set OPENAI_API_KEY and INTERNAL_API_KEY
```

### 2. Start infrastructure (postgres + redis only)

```bash
docker-compose up postgres redis -d
```

### 3. Start the backend

```bash
cd backend
npm install
npm run dev          # tsx watch — hot reload
```

The API is available at `http://localhost:3000`
Swagger docs: `http://localhost:3000/docs`

### 4. Start the AI service

```bash
cd ai_service
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

AI service docs: `http://localhost:8000/docs`

### 5. Full stack (Docker)

```bash
docker-compose up --build
```

---

## API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | — | Register |
| POST | `/api/v1/auth/login` | — | Login → JWT |
| GET | `/api/v1/search?q=` | optional | Search courses |
| GET | `/api/v1/search/trending` | — | Trending courses |
| GET | `/api/v1/search/recommendations` | ✓ | AI recommendations |
| GET | `/api/v1/courses` | — | List published courses |
| POST | `/api/v1/courses` | creator | Create course |
| GET | `/api/v1/courses/:id` | — | Get course |
| PATCH | `/api/v1/courses/:id` | creator | Update course |
| POST | `/api/v1/courses/:id/publish` | creator | Publish course |
| POST | `/api/v1/courses/:id/archive` | creator | Archive course |
| DELETE | `/api/v1/courses/:id` | creator | Delete draft |
| GET | `/api/v1/courses/:id/reviews` | — | Course reviews |
| POST | `/api/v1/courses/:id/reviews` | ✓ | Submit review |
| GET | `/api/v1/enrollments/my` | ✓ | My enrollments |
| POST | `/api/v1/enrollments/free` | ✓ | Enrol (free) |
| POST | `/api/v1/enrollments/pay` | ✓ | Initiate payment |
| POST | `/api/v1/enrollments/:courseId/progress/sync` | ✓ | Sync progress |
| GET | `/api/v1/subscriptions/current` | ✓ | Current subscription |
| POST | `/api/v1/subscriptions` | ✓ | Subscribe |
| DELETE | `/api/v1/subscriptions/current` | ✓ | Cancel |
| GET | `/api/v1/certificates/my` | ✓ | My certificates |
| GET | `/api/v1/certificates/verify/:code` | — | Verify cert |
| POST | `/api/v1/certificates` | ✓ | Issue certificate |
| GET | `/api/v1/profile/me` | ✓ | My profile |
| PATCH | `/api/v1/profile/me` | ✓ | Update profile |
| GET | `/api/v1/profile/creators/:id` | — | Creator profile |
| POST | `/api/v1/profile/follow/:userId` | ✓ | Follow user |
| DELETE | `/api/v1/profile/follow/:userId` | ✓ | Unfollow user |
| GET | `/api/v1/learning-paths` | — | List paths |
| POST | `/api/v1/learning-paths` | creator | Create path |
| POST | `/api/v1/learning-paths/:id/publish` | creator | Publish path |
| PUT | `/api/v1/learning-paths/:id/reorder` | creator | Reorder courses |
| POST | `/api/v1/webhooks/stripe` | sig | Stripe webhook |
| POST | `/api/v1/webhooks/paystack` | sig | Paystack webhook |
| GET | `/health` | — | Health check |

---

## Deploy to Render

1. Push to GitHub
2. Go to [render.com/dashboard](https://render.com/dashboard)
3. New → Blueprint → connect repo → select `render.yaml`
4. Render auto-provisions postgres, redis, and both web services
5. In each service's **Environment** tab, set the secret keys marked `sync: false` in `render.yaml`:
   - `JWT_SECRET` — random 64-char string
   - `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
   - `PAYSTACK_SECRET_KEY`
   - `OPENAI_API_KEY`
   - `AI_INTERNAL_API_KEY` — same value in both backend and ai_service
6. Trigger a manual deploy

### Stripe webhook (after deploy)
```
stripe listen --forward-to https://<your-render-url>/api/v1/webhooks/stripe
```
Or register `https://<backend-url>/api/v1/webhooks/stripe` in the Stripe dashboard.

---

## Environment variables quick reference

| Variable | Service | Required | Notes |
|----------|---------|----------|-------|
| `JWT_SECRET` | backend | ✓ | 64+ char random string |
| `DATABASE_URL` | backend | prod | Set by Render automatically |
| `REDIS_URL` | backend | prod | Set by Render automatically |
| `STRIPE_SECRET_KEY` | backend | for payments | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | backend | for webhooks | `whsec_...` |
| `PAYSTACK_SECRET_KEY` | backend | for Paystack | `sk_live_...` |
| `AI_SERVICE_URL` | backend | ✓ | URL of ai_service |
| `AI_INTERNAL_API_KEY` | backend | ✓ | Must match ai_service |
| `OPENAI_API_KEY` | ai_service | ✓ | LLM provider key |
| `INTERNAL_API_KEY` | ai_service | ✓ | Must match backend |

---

## What's new in v2 (batch update)

New entities: `Enrollment`, `Review`, `Subscription`, `Certificate`, `LearningPath`  
Updated entities: `User` (subscriptionTier, interests), `Course` (qualityScore, averageRating, tags)

New service modules:
- **SearchService** — semantic search with trust graph + quality score weighting
- **EnrollmentService** — free and paid enrolments, progress syncing
- **ReviewService** — ratings, quality score computation
- **SubscriptionService** — Creator Pro / Learner Pro plans
- **CertificateService** — auto-issue on completion, public verification
- **LearningPathService** — curated course sequences
- **ProfileService** — user profiles + trust graph follow/unfollow
- **WebhookService** — Stripe + Paystack lifecycle events
- **AiService** — HTTP client to FastAPI AI service

New AI features:
- `/v1/recommendations` — LLM-powered personalised course recommendations

Infrastructure:
- `render.yaml` — one-command Render Blueprint deployment
- `docker-compose.yml` — health checks on all services
- `.gitignore` — comprehensive Node + Python rules
