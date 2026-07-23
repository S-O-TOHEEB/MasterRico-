import { AppDataSource } from "../config/database.js";
import { Enrollment, EnrollmentStatus } from "../entities/Enrollment.js";
import { Subscription, SubscriptionStatus } from "../entities/Subscription.js";
import { Media, MediaProcessingStatus } from "../entities/Media.js";
import { EnrollmentService } from "./EnrollmentService.js";
import { SubscriptionService } from "./SubscriptionService.js";
import { CertificateService } from "./CertificateService.js";
import { CorporateService } from "./CorporateService.js";
import { paymentLedgerService } from "./PaymentLedgerService.js";
import { PaymentType } from "../entities/Payment.js";
import logger from "../utils/logger.js";
import crypto from "crypto";

export class WebhookService {
  private enrollmentRepo = AppDataSource.getRepository(Enrollment);
  private subscriptionRepo = AppDataSource.getRepository(Subscription);
  private mediaRepo = AppDataSource.getRepository(Media);
  private enrollmentService = new EnrollmentService();
  private subscriptionService = new SubscriptionService();
  private certificateService = new CertificateService();
  private corporateService = new CorporateService();

  /**
   * A single PaymentIntent/charge only ever carries the metadata for ONE of
   * these four purchase types (see EnrollmentService.initiatePayment,
   * SubscriptionService.initiate, CorporateService.initiatePurchase,
   * CertificateService.initiateVerifiedPayment — each sets its own distinct
   * metadata keys and none of them overlap), so checking them in sequence
   * and stopping at the first match is safe rather than ambiguous.
   */
  private async completePurchase(
    metadata: Record<string, string>,
    amountPence: number,
    gatewayRef: string,
    gateway: "stripe" | "paystack"
  ): Promise<void> {
    if (metadata.enrollmentId) {
      await this.enrollmentService.activateEnrollment(metadata.enrollmentId, gatewayRef);
      await paymentLedgerService.markPaidByReference(PaymentType.COURSE_ENROLLMENT, metadata.enrollmentId, gatewayRef);
      logger.info(`[Webhook/${gateway}] Enrollment ${metadata.enrollmentId} activated`);
      return;
    }

    if (metadata.subscriptionId) {
      await this.subscriptionService.activate(metadata.subscriptionId, gatewayRef, gateway);
      await paymentLedgerService.markPaidByReference(PaymentType.SUBSCRIPTION, metadata.subscriptionId, gatewayRef);
      logger.info(`[Webhook/${gateway}] Subscription ${metadata.subscriptionId} activated`);
      return;
    }

    if (metadata.corporateAccountId) {
      await this.corporateService.activateAccount(metadata.corporateAccountId);
      await paymentLedgerService.markPaidByReference(PaymentType.CORPORATE_ACCOUNT, metadata.corporateAccountId, gatewayRef);
      logger.info(`[Webhook/${gateway}] Corporate account ${metadata.corporateAccountId} activated`);
      return;
    }

    if (metadata.type === PaymentType.VERIFIED_CERTIFICATE && metadata.userId && metadata.courseId) {
      await this.certificateService.issueVerified(metadata.userId, metadata.courseId, amountPence);
      // No referenceId to mark PAID by here — see PaymentOrchestrator's doc
      // comment: a cert's own record doesn't exist until issueVerified just
      // above creates it, so its ledger row was created without a
      // referenceId and has nothing to match against. The now-issued,
      // now-verified certificate is the actual source of truth for "did
      // this succeed", so leaving that one ledger row at PENDING is fine.
      logger.info(`[Webhook/${gateway}] Verified certificate issued for user ${metadata.userId}, course ${metadata.courseId}`);
      return;
    }

    logger.warn(`[Webhook/${gateway}] Payment succeeded but metadata matched no known purchase type`, metadata);
  }

  /** Counterpart to completePurchase for payment_intent.payment_failed / charge.failed. */
  private async failPurchase(
    metadata: Record<string, string>,
    reason: string,
    gateway: "stripe" | "paystack",
    providerReference?: string
  ): Promise<void> {
    if (metadata.enrollmentId) {
      await paymentLedgerService.markFailedByReference(PaymentType.COURSE_ENROLLMENT, metadata.enrollmentId, reason, providerReference);
    } else if (metadata.subscriptionId) {
      await paymentLedgerService.markFailedByReference(PaymentType.SUBSCRIPTION, metadata.subscriptionId, reason, providerReference);
    } else if (metadata.corporateAccountId) {
      await paymentLedgerService.markFailedByReference(PaymentType.CORPORATE_ACCOUNT, metadata.corporateAccountId, reason, providerReference);
    }
    logger.info(`[Webhook/${gateway}] Payment failed — ${reason}`);
  }

  // ── Stripe ──────────────────────────────────────────────────────────────────

  verifyStripeSignature(rawBody: Buffer, signature: string): boolean {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      logger.warn("[WebhookService] STRIPE_WEBHOOK_SECRET not configured");
      return false;
    }
    try {
      const parts = signature.split(",");
      const ts = parts.find((p) => p.startsWith("t="))?.slice(2);
      const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3);
      if (!ts || !v1) return false;
      const payload = `${ts}.${rawBody.toString()}`;
      const expected = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
      return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  async handleStripeEvent(event: {
    type: string;
    data: { object: Record<string, unknown> };
  }): Promise<void> {
    const obj = event.data.object;

    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = obj as { id: string; amount: number; metadata: Record<string, string> };
        await this.completePurchase(pi.metadata, pi.amount, pi.id, "stripe");
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = obj as {
          id: string;
          metadata: Record<string, string>;
          last_payment_error?: { message?: string };
        };
        const reason = pi.last_payment_error?.message ?? "Payment failed";
        await this.failPurchase(pi.metadata, reason, "stripe", pi.id);
        break;
      }

      // NOTE: this app currently charges subscriptions, corporate licences,
      // and verified certificates as one-off PaymentIntents (see
      // completePurchase above) rather than through Stripe's own Subscription
      // object — so customer.subscription.* / invoice.* events below won't
      // fire from that flow today. They're kept here, ready to go, for if/when
      // recurring plans move to real Stripe Subscriptions (auto-renewal
      // without re-initiating a charge each period).
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = obj as {
          id: string;
          status: string;
          metadata: Record<string, string>;
          current_period_end: number;
        };
        const { subscriptionId } = sub.metadata;
        if (subscriptionId && sub.status === "active") {
          await this.subscriptionService.activate(subscriptionId, sub.id, "stripe");

          // Extend period end
          await this.subscriptionRepo.update(subscriptionId, {
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            status: SubscriptionStatus.ACTIVE,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = obj as { metadata: Record<string, string> };
        if (sub.metadata.subscriptionId) {
          await this.subscriptionService.expire(sub.metadata.subscriptionId);
          logger.info(`[Webhook/Stripe] Subscription ${sub.metadata.subscriptionId} expired`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv = obj as { subscription: string };
        if (inv.subscription) {
          await this.subscriptionRepo.update(
            { stripeSubscriptionId: inv.subscription },
            { status: SubscriptionStatus.PAST_DUE }
          );
        }
        break;
      }

      default:
        logger.debug(`[Webhook/Stripe] Unhandled event: ${event.type}`);
    }
  }

  // ── Paystack ─────────────────────────────────────────────────────────────────

  verifyPaystackSignature(rawBody: Buffer, signature: string): boolean {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return false;
    const hash = crypto
      .createHmac("sha512", secret)
      .update(rawBody)
      .digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
    } catch {
      // Buffers of different lengths (e.g. a malformed signature header) —
      // timingSafeEqual throws rather than returning false for that case.
      return false;
    }
  }

  async handlePaystackEvent(event: {
    event: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    const data = event.data;

    switch (event.event) {
      case "charge.success": {
        const metadata = (data.metadata as Record<string, string>) ?? {};
        const amount = data.amount as number;
        const reference = data.reference as string;
        await this.completePurchase(metadata, amount, reference, "paystack");
        break;
      }

      case "charge.failed": {
        const metadata = (data.metadata as Record<string, string>) ?? {};
        const reason = (data.gateway_response as string) ?? "Payment failed";
        const reference = data.reference as string | undefined;
        await this.failPurchase(metadata, reason, "paystack", reference);
        break;
      }

      // NOTE: same caveat as the Stripe customer.subscription.* handlers above —
      // Paystack's own recurring "subscription" object isn't what
      // SubscriptionService.initiate() creates today (it's a one-off
      // transaction/initialize charge, handled by charge.success above), so
      // these two won't fire from that flow. Kept for a future move to
      // Paystack's real subscription/plan API.
      case "subscription.create": {
        const { subscriptionId } = (data.metadata as Record<string, string>) ?? {};
        if (subscriptionId) {
          await this.subscriptionService.activate(
            subscriptionId,
            data.subscription_code as string,
            "paystack"
          );
        }
        break;
      }

      case "subscription.disable": {
        const { subscriptionId } = (data.metadata as Record<string, string>) ?? {};
        if (subscriptionId) await this.subscriptionService.expire(subscriptionId);
        break;
      }

      default:
        logger.debug(`[Webhook/Paystack] Unhandled event: ${event.event}`);
    }
  }

  /**
   * Auto-issue certificate when an enrollment reaches 100% progress.
   * Called from EnrollmentService.syncProgress.
   */
  async onCourseCompletion(userId: string, courseId: string): Promise<void> {
    try {
      await this.certificateService.issue(userId, courseId);
      logger.info(`[WebhookService] Certificate issued for user ${userId}, course ${courseId}`);
    } catch (err) {
      logger.error("[WebhookService] Certificate issue failed", err);
    }
  }

  // ── Mux (video processing) ────────────────────────────────────────────────
  //
  // Architecture: browser → Mux Direct Upload (TUS) → Mux processes the
  // video → Mux webhook (here) → backend marks the Media row READY →
  // frontend picks that up next time it reads GET /media/:id. See
  // MediaController.createVideoUpload for where the PROCESSING row and its
  // muxUploadId get created in the first place, and MuxService for the
  // upload-session creation itself. Deliberately no polling endpoint —
  // completion is entirely webhook-driven.

  /** Same t=/v1= HMAC-SHA256 scheme as Stripe's Stripe-Signature header — Mux uses an identical format. */
  verifyMuxSignature(rawBody: Buffer, signature: string): boolean {
    const secret = process.env.MUX_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    try {
      const parts = signature.split(",");
      const ts = parts.find((p) => p.startsWith("t="))?.slice(2);
      const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3);
      if (!ts || !v1) return false;
      const payload = `${ts}.${rawBody.toString()}`;
      const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  async handleMuxEvent(event: { type: string; data: Record<string, unknown> }): Promise<void> {
    const data = event.data;

    switch (event.type) {
      case "video.asset.ready": {
        const passthrough = data.passthrough as string | undefined;
        const assetId = data.id as string;
        const playbackId = (data.playback_ids as Array<{ id: string }> | undefined)?.[0]?.id;
        const duration = data.duration as number | undefined;

        if (!passthrough) {
          logger.warn(`[Webhook/Mux] video.asset.ready for asset ${assetId} had no passthrough — can't correlate to a Media row`);
          break;
        }
        if (!playbackId) {
          logger.warn(`[Webhook/Mux] video.asset.ready for asset ${assetId} had no playback_ids — leaving Media ${passthrough} as PROCESSING`);
          break;
        }

        await this.mediaRepo.update(
          { id: passthrough },
          {
            status: MediaProcessingStatus.READY,
            fileUrl: `https://stream.mux.com/${playbackId}.m3u8`,
            thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
            muxAssetId: assetId,
            muxPlaybackId: playbackId,
            durationSeconds: duration ? Math.round(duration) : undefined,
          }
        );
        logger.info(`[Webhook/Mux] Media ${passthrough} marked READY (asset ${assetId})`);
        break;
      }

      case "video.asset.errored": {
        const passthrough = data.passthrough as string | undefined;
        if (passthrough) {
          await this.mediaRepo.update({ id: passthrough }, { status: MediaProcessingStatus.ERRORED });
          logger.warn(`[Webhook/Mux] Media ${passthrough} marked ERRORED`, data.errors);
        }
        break;
      }

      default:
        logger.debug(`[Webhook/Mux] Unhandled event: ${event.type}`);
    }
  }
}
