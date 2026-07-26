import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import {
  myPayments, getPayment, listPayments,
  updatePaymentStatus, refundPayment, removePayment,
} from "../controllers/PaymentController.js";
import { authenticate, authorize } from "../middlewares/auth.js";

const router = createRouter();

/**
 * There is deliberately no generic POST /payments/initialize here. An
 * earlier version had one — it took `amount` and `metadata` (including
 * `enrollmentId`/`subscriptionId`/`corporateAccountId`) straight from the
 * request body and handed them to the gateway unmodified. That let an
 * authenticated user create a real enrollment/subscription for its actual
 * price, then call that endpoint directly with a trivial amount but the
 * same referenceId, pay the tiny charge, and have the webhook activate the
 * full-price resource — completePurchase correlated purely by id and never
 * checked the amount paid against the resource's real price.
 *
 * Every real payment flow computes its amount server-side and calls
 * PaymentOrchestrator.initializePayment() directly from its own service —
 * see EnrollmentService.initiatePayment, SubscriptionService.initiate,
 * CorporateService.initiatePurchase, CertificateService.initiateVerifiedPayment.
 * None of them need or use an HTTP endpoint for this step. If a future
 * feature genuinely needs a client-facing "start a payment" endpoint, it
 * must derive the amount from a server-side lookup (course/plan/tier price),
 * never accept it as a request body field — and WebhookService.completePurchase
 * now independently verifies the paid amount against the referenced
 * resource's stored price regardless, as defense in depth.
 *
 * Stripe webhook  → POST /api/v1/webhooks/stripe
 * Paystack webhook → POST /api/v1/webhooks/paystack
 *
 * NOTE: Webhook handlers live in webhookRoutes.ts (mounted before
 * express.json() so raw body is available for HMAC verification).
 * Do NOT add webhook routes here.
 */

// ── Payments ledger ──────────────────────────────────────────────────────────
router.get(   "/my",           authenticate, myPayments);
router.get(   "/:id",          authenticate, getPayment); // owner or admin — checked inside the controller
router.get(   "/",             authenticate, authorize("admin"), listPayments);
router.patch( "/:id/status",   authenticate, authorize("admin"), updatePaymentStatus);
router.post(  "/:id/refund",   authenticate, authorize("admin"), refundPayment);
router.delete("/:id",          authenticate, authorize("admin"), removePayment);

export default router;
