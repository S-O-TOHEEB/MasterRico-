import crypto from "crypto";
import Stripe from "stripe";
import { type IPaymentGateway, type PaymentIntent } from "./IPaymentGateway.js";
import logger from "../../utils/logger.js";

function mapStatus(stripeStatus: Stripe.PaymentIntent.Status): PaymentIntent["status"] {
  switch (stripeStatus) {
    case "succeeded":
      return "completed";
    case "canceled":
      return "failed";
    default:
      // requires_payment_method, requires_confirmation, requires_action,
      // processing, requires_capture — all still in-flight from our side
      return "pending";
  }
}

export class StripeGateway implements IPaymentGateway {
  private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  private readonly stripe: Stripe | null;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      logger.warn("[StripeGateway] STRIPE_SECRET_KEY is not set — Stripe payment intents will fail until it is.");
      this.stripe = null;
    } else {
      this.stripe = new Stripe(secretKey);
    }
  }

  async createPaymentIntent(amount: number, currency: string, email: string, metadata: any): Promise<PaymentIntent> {
    if (!this.stripe) {
      throw new Error("Stripe is not configured — set STRIPE_SECRET_KEY");
    }

    // amount arrives already in the smallest currency unit (pence for GBP,
    // cents for USD, etc.) — same convention this codebase uses everywhere
    // else (Course.pricePence, Enrollment.amountPaid, ...), and exactly what
    // Stripe's API expects too, so no conversion happens here.
    const intent = await this.stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      receipt_email: email,
      metadata: stringifyMetadata(metadata),
      automatic_payment_methods: { enabled: true },
    });

    return {
      id: intent.id,
      amount,
      currency,
      status: mapStatus(intent.status),
      clientSecret: intent.client_secret ?? undefined,
    };
  }

  /** Real refund via Stripe's Refunds API. Falls back to a labelled stub
   *  when Stripe isn't configured, so PaymentController.refund can still
   *  move the ledger row to REFUNDED (e.g. for a manual/offline refund)
   *  without the whole request failing. */
  async refund(providerReference: string): Promise<{ success: boolean; stubbed: boolean }> {
    if (!this.stripe) {
      logger.info(`[StripeGateway] STUB (no STRIPE_SECRET_KEY set) — would refund payment intent ${providerReference}`);
      return { success: true, stubbed: true };
    }
    try {
      await this.stripe.refunds.create({ payment_intent: providerReference });
      return { success: true, stubbed: false };
    } catch (error: any) {
      logger.error(`[StripeGateway] Refund failed for ${providerReference}: ${error.message}`);
      return { success: false, stubbed: false };
    }
  }

  async verifyWebhook(payload: any, signature: string): Promise<boolean> {
    if (!this.webhookSecret || !signature) {
      return false;
    }

    // Stripe-Signature header looks like: "t=<timestamp>,v1=<hex signature>"
    const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
      const [key, value] = part.split("=");
      if (key && value) acc[key] = value;
      return acc;
    }, {});

    const timestamp = parts.t;
    const expectedSig = parts.v1;
    if (!timestamp || !expectedSig) {
      return false;
    }

    // NOTE: as with Paystack, this needs the raw request body bytes
    // (express.raw()) to match Stripe's signature in production.
    const rawBody = typeof payload === "string" ? payload : JSON.stringify(payload);
    const signedPayload = `${timestamp}.${rawBody}`;
    const hash = crypto.createHmac("sha256", this.webhookSecret).update(signedPayload).digest("hex");

    try {
      return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedSig, "hex"));
    } catch {
      return false;
    }
  }

  // NOTE: not on the live path — the real, DB-updating handler is
  // WebhookService.handleStripeEvent, wired from WebhookController.stripe.
  // This method exists only to satisfy IPaymentGateway.
  async handleWebhook(payload: any): Promise<void> {
    logger.info("Handling Stripe Webhook", payload.type);
  }
}

// Stripe requires metadata values to be strings — this codebase's callers
// pass a mix of strings/numbers/undefined (see EnrollmentService,
// SubscriptionService, CorporateService, CertificateService), so normalize
// here rather than push that concern onto every call site.
function stringifyMetadata(metadata: any): Record<string, string> {
  if (!metadata || typeof metadata !== "object") return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  }
  return result;
}
