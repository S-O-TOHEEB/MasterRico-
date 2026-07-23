# Changelog

This replaces an earlier `PATCH_NOTES.md` that no longer matched this
codebase (most of its claims didn't apply here — see git history if you need
it, but it's not worth trusting). This file reflects verified work only:
every entry below was typechecked, built, and either integration-tested or
boot-tested before being considered done.

## Audit round 3 — moderation/payments hardening

- Fixed `GET /media/:id` — added the owner-or-admin check it was missing
  (`DELETE /media/:id` had it, this didn't)
- Added rate limiting (10/hour per user) to the three content-report
  endpoints — the only rate limiting anywhere in the app currently
- Consolidated pagination handling into `utils/pagination.ts`; fixed a
  negative-page bug that existed in two places independently
- Fixed `PaymentLedgerService.transition` to target the specific gateway
  transaction reference from a webhook event rather than "most recent
  payment for this reference" — the old approach could let a late/stale
  webhook for a declined first attempt flip an already-successful retry back
  to `FAILED`. Added a state-machine guard as a second layer of defense.

## Audit round 2 — new-code hardening

- Fixed an orphaned-record bug: `POST /media/video/upload` now cleans up the
  `Media` row it creates if the Mux API call fails, instead of leaving a
  `PROCESSING` row that could never complete
- Fixed `POST /payments/:id/refund` silently reporting success when Stripe/Paystack
  aren't configured — now requires explicit `{ "acknowledgeStub": true }`
  to move a ledger row to `REFUNDED` without a real gateway call
- Added input validation to `GET /payments` query filters (`status`, `type`,
  `provider`, `from`, `to`) — invalid values used to reach Postgres as a raw
  enum/date error (500) instead of a clean 400
- Added a missing `fileName` check on video upload

## Feature-parity reconciliation (+22 endpoints, 148 → 170)

Brought the backend in line with a separately-developed branch that had
pulled ahead in a few areas:

- **Payments ledger** — new `Payment` entity + `PaymentLedgerService`,
  auto-recorded by every payment flow; full CRUD (`GET /payments`,
  `/payments/my`, `/payments/:id`, `PATCH .../status`, `POST .../refund`,
  `DELETE`); real `refund()` added to both gateways
- **Content moderation** — 9-endpoint admin queue + 3 report endpoints for
  discussions and reviews (the `isFlagged` fields already existed on those
  entities, just weren't wired to anything)
- **Mux video architecture rebuilt** from poll-based to fully webhook-driven
  (`POST /webhooks/mux`) — see `docs/ARCHITECTURE.md`
- Enrollment cancellation (`DELETE /enrollments/:courseId`, free courses only)
- Lesson summaries (`GET /lessons/:lessonId/summary`) — wired up an
  `AiService.ts` client that already existed in the codebase but was never
  called from anywhere
- `payment_intent.payment_failed` / `charge.failed` webhook handling, which
  fell out naturally once there was a ledger to update

## Remaining stubs closed out

- **Creator payout** — real Stripe Connect Express onboarding (was a fake
  OAuth URL)
- **Saved payment methods** — real Stripe/Paystack verification; redesigned
  the request contract since the old one let the client assert its own
  card brand/last4/expiry instead of the gateway confirming them
- **Live sessions** — real LiveKit room creation and per-participant join
  tokens (was a fake stream URL)

## First audit — security and reliability

- `JWT_SECRET`: removed an insecure `"change-me"` fallback; the server now
  refuses to boot without a real one (`src/config/env.ts`)
- Fixed a timing-attack-vulnerable Paystack webhook signature check
  (was `===`, now `crypto.timingSafeEqual`, matching the Stripe path)
- Built `utils/safeRouter.ts` and applied it to all 29 route files — Express 4
  doesn't auto-catch async handler rejections, so an unhandled error used to
  leave a request hanging with no response rather than returning a clean
  error
- Fixed a duplicate-webhook-delivery bug in `EnrollmentService.activateEnrollment`
  that could double-count `enrollmentCount`/`totalRevenuePence`
- Fixed race conditions in RSVP capacity and corporate seat-limit checks
  (read-then-write → atomic conditional `UPDATE`)
- Added `.gitignore` (there wasn't one — real risk of committing `.env`)

## Real storage and payment integrations

- File storage: real S3 presigned URLs, Cloudinary signed uploads, and a
  genuinely working local-disk fallback (was entirely stubbed, returning
  fake URLs)
- Video: real Mux integration (was stubbed)
- Stripe checkout: real `PaymentIntent` creation (was a hardcoded mock
  response; Paystack's checkout was already real at this point)
- Fixed a corporate-account bug found in the process: accounts were being
  created fully `ACTIVE` before payment confirmed, letting anyone invite
  unlimited team members without ever paying — added a `PENDING` status,
  gated on webhook confirmation
