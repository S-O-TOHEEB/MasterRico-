# API reference

Base URL: `/api/v1` (webhooks are the one exception — see below).
170 endpoints total. This is a map, not a full schema reference — for
request/response bodies, run the server and check `GET /docs` (live Swagger),
or ask for the Postman collection.

**Auth column key:** `public` = no token needed · `auth` = any logged-in user ·
`admin` = `authorize("admin")` · `owner` = auth + an ownership/access check
inside the controller, not just role-based

| Feature area | Base path | Auth | Endpoints | Notes |
|---|---|---|---|---|
| Auth | `/auth` | mixed | 7 | register, login, OTP verify/resend, password reset request/confirm, change password |
| Courses | `/courses` | mixed | 8 | public browse/detail, creator-only create/update |
| Course reviews | `/courses/:courseId/reviews`, `/reviews` | mixed | 6 | includes report (rate-limited) |
| Search | `/search` | public | 3 | full-text + AI-powered recommendations |
| Enrollments | `/enrollments` | auth | 6 | includes `DELETE /:courseId` — free courses only, see [ARCHITECTURE.md](ARCHITECTURE.md) |
| Subscriptions | `/subscriptions` | auth | 3 | plan selection, one-off charge per period (not Stripe recurring Subscriptions — see architecture notes on webhook handling) |
| Certificates | `/certificates` | auth | 4 | free completion certs + paid verified certs |
| Profile | `/profile` | mixed | 8 | own profile (auth) + public creator profile/portfolio |
| Learning paths | `/learning-paths` | mixed | 8 | curated course sequences |
| Course sections | `/courses/:courseId/sections` | owner | 5 | creator-only management |
| Lessons | `/courses/:courseId/sections/:sectionId/lessons`, `/lessons` | mixed | 8 | includes AI-generated `GET /:lessonId/summary` |
| Creator tools | `/creator` | owner | 7 | analytics + payout onboarding (real Stripe Connect) |
| Discussions | `/courses/:courseId/discussions`, `/discussions` | mixed | 13 | posts, replies, pin, report (rate-limited) |
| Notifications | `/notifications` | auth | 4 | |
| Corporate accounts | `/corporate` | owner/admin | 8 | seat-limited team licences, PENDING until payment confirms |
| Gamification | `/gamification` | auth | 3 | streaks, badges |
| Referrals | `/referrals` | auth | 3 | |
| Live sessions | `/live-sessions` | mixed | 13 | includes real LiveKit room creation + join tokens |
| Leaderboard | `/leaderboard` | public | 1 | |
| Admin | `/admin` | admin | 12 | founder grants + full content moderation queue |
| Users | `/users` | auth | 3 | |
| Media | `/media` | owner | 7 | upload URLs (S3/Cloudinary/local), video upload (Mux), delete |
| Payments | `/payments` | mixed | 7 | initialize + full ledger (list/get/refund/status/delete) |
| Progress | `/progress` | auth | 2 | |
| Trust connections | `/trust` | auth | 4 | |
| Payment methods | `/payment-methods` | auth | 4 | real Stripe/Paystack card verification, not client-trusted |
| Portfolio | `/portfolio` | mixed | 5 | creator showcase projects |
| Messages | `/messages` | auth | 5 | direct messaging/conversations |
| **Webhooks** | `/api/v1/webhooks` | signature-verified | 3 | `/stripe`, `/paystack`, `/mux` — mounted before the JSON body parser to preserve raw bytes for HMAC verification; see [ARCHITECTURE.md](ARCHITECTURE.md) |

## A few endpoints worth knowing about specifically

- `GET /health` — outside `/api/v1`, no auth, for load balancer health checks
- `GET /docs` — live Swagger UI
- `GET /uploads/*` — static file serving for `STORAGE_PROVIDER=local` only

## Admin moderation queue (`/admin/moderation/...`)

Nine of the twelve `/admin` endpoints are the content moderation queue:

| Method | Path |
|---|---|
| GET | `/admin/moderation/reviews` |
| POST | `/admin/moderation/reviews/:id/unflag` |
| DELETE | `/admin/moderation/reviews/:id` |
| GET | `/admin/moderation/discussions/posts` |
| GET | `/admin/moderation/discussions/replies` |
| POST | `/admin/moderation/discussions/posts/:id/unflag` |
| POST | `/admin/moderation/discussions/replies/:id/unflag` |
| DELETE | `/admin/moderation/discussions/posts/:id` |
| DELETE | `/admin/moderation/discussions/replies/:id` |

## Payments ledger (`/payments/...`)

| Method | Path | Auth |
|---|---|---|
| POST | `/payments/initialize` | auth |
| GET | `/payments/my` | auth |
| GET | `/payments/:id` | owner or admin |
| GET | `/payments` | admin |
| PATCH | `/payments/:id/status` | admin |
| POST | `/payments/:id/refund` | admin |
| DELETE | `/payments/:id` | admin (soft delete) |
