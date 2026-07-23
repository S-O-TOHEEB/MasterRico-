# Architecture notes

This covers the parts of the system that aren't obvious from reading a
single file in isolation — mostly things that span multiple
services/controllers/webhooks, where the "why" matters as much as the "what."

## Payments

### Gateway routing

`PaymentOrchestrator.getGateway(currency)` picks Stripe or Paystack
automatically: `NGN`/`GHS`/`ZAR`/`KES` → Paystack, everything else → Stripe.
Callers never pick a gateway directly — they call
`PaymentOrchestrator.initializePayment(amount, currency, email, metadata)`
and get back whichever gateway's `PaymentIntent` shape applies.

### The ledger

Every single payment flow — course enrollment, subscription, corporate
account, verified certificate — calls the same
`PaymentOrchestrator.initializePayment`, which means every one of them also
creates a row in the `payments` table automatically
(`PaymentLedgerService.record`, called from inside the orchestrator, not by
each individual caller). That's what powers `GET /payments/my`,
`GET /payments/:id`, and the admin surface (`GET /payments`,
`PATCH /payments/:id/status`, `POST /payments/:id/refund`).

`metadata.type` (a `PaymentType` enum value) tells the orchestrator which
kind of payment this is, and `metadata.userId` / `metadata.adminUserId`
identifies who it belongs to. Every current caller sets these — see
`EnrollmentService.initiatePayment`, `SubscriptionService.initiate`,
`CorporateService.initiatePurchase`, `CertificateService.initiateVerifiedPayment`
for the four examples.

One exception worth knowing: verified-certificate payments don't have a
`referenceId` at creation time, because the certificate record itself
doesn't exist until *after* payment succeeds (`CertificateService.issueVerified`
creates it). So that one ledger row is created without a `referenceId` and
stays that way — the certificate itself, now issued and verified, is the
actual source of truth for "did this succeed," not the ledger row's
`referenceId` field.

### Webhook idempotency and precise targeting

Stripe and Paystack both explicitly document that a webhook event can be
delivered more than once, and delivery order isn't guaranteed. Two things in
`WebhookService`/`PaymentLedgerService` exist specifically because of that:

1. **`EnrollmentService.activateEnrollment`** uses a conditional `UPDATE ...
   WHERE status != 'active'` rather than an unconditional write, so a
   duplicate `payment_intent.succeeded` delivery can't double-increment
   `course.enrollmentCount` / `totalRevenuePence`.

2. **`PaymentLedgerService.transition`** (used by both `markPaidByReference`
   and `markFailedByReference`) looks up the ledger row by the *specific*
   gateway transaction reference from the webhook event (`providerReference`),
   not "most recent row for this enrollment/subscription/etc." That
   distinction matters on a retry: if a card gets declined (attempt A →
   `FAILED`) and the user retries successfully (attempt B → `PAID`), a
   late-arriving failure webhook for attempt A must not be allowed to flip
   attempt B back to `FAILED`. There's also a state-machine guard
   (`VALID_TRANSITIONS`) as a second layer of defense — even if the wrong
   row were somehow targeted, an invalid transition like `PAID → FAILED` is
   refused and logged rather than applied.

### Refunds

`POST /payments/:id/refund` calls the real Stripe/Paystack refund API when
credentials are configured. When they aren't, the gateway returns a labelled
stub result (`{ success: true, stubbed: true }`) rather than throwing — but
the controller **refuses to move the ledger to `REFUNDED` on a stubbed
result** unless the caller explicitly passes `{ "acknowledgeStub": true }`.
This is deliberate: a stub that silently reports success on a financial
action is a worse failure mode than one that visibly does nothing — an admin
panel that doesn't specifically check a `gatewayStubbed` flag would otherwise
show "refund successful" when no money moved.

## Video (Mux)

```
Browser
   │  1. POST /media/video/upload
   ▼
Backend creates a Media row (status: PROCESSING, no fileUrl yet)
   │  2. calls Mux to create a direct-upload session,
   │     passing the Media row's own id as Mux's `passthrough`
   ▼
Mux returns { uploadId, uploadUrl }
   │  3. backend returns { mediaId, uploadUrl } to the browser
   ▼
Browser uploads the raw video file directly to Mux
   │  (resumable/TUS protocol — needs a client library like
   │   @mux/upchunk, not a plain fetch/PUT; bytes never pass
   │   through this backend, same as the S3/Cloudinary paths)
   ▼
Mux transcodes the video
   │  4. Mux calls POST /webhooks/mux with video.asset.ready,
   │     echoing back the passthrough (the Media row's id)
   ▼
WebhookService.handleMuxEvent finds the Media row by that id
   and marks it READY, with the real HLS URL, thumbnail, and duration
   │
   ▼
Frontend picks this up next time it reads GET /media/:id
```

There's deliberately no polling endpoint — completion is entirely
webhook-driven. `MuxService` only has two responsibilities: create the
upload session, and that's it; `WebhookService.verifyMuxSignature` +
`handleMuxEvent` handle everything after that. The signature scheme is the
same `t=<timestamp>,v1=<hex hmac-sha256>` format Stripe uses.

If `MuxService.createUploadSession` fails (most commonly: Mux isn't
configured yet), `MediaService.createVideoUpload` deletes the Media row it
had already created rather than leaving an orphaned `PROCESSING` record with
no way to ever complete.

## File storage (images/documents)

`StorageService`, provider-selected via `STORAGE_PROVIDER`:

- **`s3`** — real presigned `PUT` URL (`@aws-sdk/s3-request-presigner`),
  15-minute expiry. The client uploads directly to S3; this backend never
  sees the file bytes.
- **`cloudinary`** — real signed upload parameters
  (`cloudinary.utils.api_sign_request`); the client POSTs directly to
  Cloudinary and gets back `secure_url`, which it then passes to
  `POST /media` to record.
- **`local`** — a genuinely working dev fallback, not a stub. Writes to
  `./uploads` via `POST /media/local-upload` (multer) and serves it back
  through `express.static`. **Not recommended for production on Render** —
  that filesystem is ephemeral across redeploys unless a persistent disk is
  attached.

Video never uses this service — see the Mux section above for why a plain
presigned PUT doesn't work for resumable video uploads.

## Live sessions (LiveKit)

Real LiveKit rooms, not a stub. `LiveSessionService.goLive` calls
`LiveKitService.ensureRoom` to actually create the room server-side.
Joining is a separate step: `GET /live-sessions/:id/token` mints a
short-lived (4h), per-participant JWT — host or an RSVP'd attendee only.
Publish permission depends on session type: `QA` sessions let attendees
unmute/publish (open discussion), `CLASS`/`WORKSHOP` sessions are
host-publish-only, attendees subscribe-only (structured lecture format).

`LiveSessionService.endSession` tears the room down via
`LiveKitService.endRoom`, but that call is wrapped so a LiveKit failure
(not configured, room already gone) never blocks ending the session in the
database — ending a session should always succeed locally.

RSVP capacity (`maxAttendees`) is enforced with an atomic conditional
`UPDATE ... WHERE "rsvpCount" < "maxAttendees"` rather than a
read-then-write check, so two concurrent RSVPs near the cap can't both
squeeze through. `CorporateService.inviteMember`'s seat-limit check uses the
same pattern for the same reason, with a rollback if the subsequent
member-row creation fails (so a DB hiccup doesn't permanently burn a seat).

## Content moderation

`isFlagged` is a plain boolean on `DiscussionPost`, `DiscussionReply`, and
`Review` — no separate `Report` entity. Reporting sets it to `true`
immediately, which excludes the content from normal listing queries
right away (`WHERE isFlagged = false` in `listByCourse` etc.) — this is
"hide first, review after," not a multi-report threshold. An admin then
either unflags it (`POST /admin/moderation/.../:id/unflag`) or hard-deletes
it (`DELETE /admin/moderation/.../:id`).

Because a single report is an actual moderation action (not just a read),
the three report endpoints are rate-limited to 10/hour per user
(`src/middlewares/rateLimit.ts`) — this is currently the *only* rate
limiting anywhere in the app. Worth knowing if you're adding other
write-heavy public endpoints later.

## Async safety (`safeRouter`)

Express 4 (this project's version — 4.22.2) does not automatically catch a
rejected promise returned from an async route handler, unlike Express 5.
Since almost every controller in this codebase is `async (req, res) => {
...}` without its own try/catch, an unhandled rejection would otherwise
leave that request hanging with no response at all until the client's own
timeout — not a server crash, just a silently stuck request.

`src/utils/safeRouter.ts` exports `createRouter()`, a drop-in replacement
for `express.Router()` that wraps every function argument passed to a route
registration (middleware or handler) so any rejection reaches
`next(err)` → `errorHandler.ts`. Every route file in this repo uses it —
if you add a new route file, use `createRouter()` from `../utils/safeRouter.js`,
not `Router()` from `express` directly.

## Auth

`JWT_SECRET` is required at boot — `src/config/env.ts` validates it (length,
and a blocklist of common placeholder values including this project's own
old `.env.example` default) and calls `process.exit(1)` with a clear message
if it's missing or looks unedited, rather than silently falling back to a
known-weak default.
