import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import {
  initializePayment,
  myPayments, getPayment, listPayments,
  updatePaymentStatus, refundPayment, removePayment,
} from "../controllers/PaymentController.js";
import { authenticate, authorize } from "../middlewares/auth.js";

const router = createRouter();

/**
 * POST /api/v1/payments/initialize
 *
 * Kicks off a Stripe or Paystack payment session. The gateway is selected
 * automatically by the PaymentOrchestrator based on the `currency` field
 * in the request body (NGN/GHS/ZAR/KES → Paystack, everything else → Stripe).
 * Every call here also creates a PENDING row in the payments ledger below —
 * see PaymentOrchestrator.initializePayment.
 *
 * Stripe webhook  → POST /api/v1/webhooks/stripe
 * Paystack webhook → POST /api/v1/webhooks/paystack
 *
 * NOTE: Webhook handlers live in webhookRoutes.ts (mounted before
 * express.json() so raw body is available for HMAC verification).
 * Do NOT add webhook routes here.
 */
router.post("/initialize", authenticate, initializePayment);

// ── Payments ledger ──────────────────────────────────────────────────────────
router.get(   "/my",           authenticate, myPayments);
router.get(   "/:id",          authenticate, getPayment); // owner or admin — checked inside the controller
router.get(   "/",             authenticate, authorize("admin"), listPayments);
router.patch( "/:id/status",   authenticate, authorize("admin"), updatePaymentStatus);
router.post(  "/:id/refund",   authenticate, authorize("admin"), refundPayment);
router.delete("/:id",          authenticate, authorize("admin"), removePayment);

export default router;
