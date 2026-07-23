import type { Request, Response } from "express";
import { PaymentService } from "../services/PaymentService.js";
import { paymentLedgerService } from "../services/PaymentLedgerService.js";
import { PaymentStatus, PaymentType, PaymentProvider } from "../entities/Payment.js";
import { StripeGateway } from "../services/payments/StripeGateway.js";
import { PaystackGateway } from "../services/payments/PaystackGateway.js";
import { UserRole } from "../entities/User.js";
import { param } from "../utils/params.js";
import { parsePagination } from "../utils/pagination.js";

const service = new PaymentService();

export const initializePayment = async (req: Request, res: Response) => {
  try {
    const { amount, currency, metadata } = req.body;
    const user = req.user!;
    // email is available directly from the JWT payload — no unsafe cast needed
    const result = await service.initializePayment(amount, currency, user.email, {
      ...metadata,
      userId: user.id,
    });
    res.json(result);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

// ── Payment ledger (GET/admin surface — see PaymentLedgerService) ───────────

// GET /payments/my
export const myPayments = async (req: Request, res: Response) => {
  const { page, limit } = parsePagination(req);
  const data = await paymentLedgerService.listForUser(req.user!.id, page, limit);
  res.json({ success: true, data });
};

// GET /payments/:id — owner or admin only
export const getPayment = async (req: Request, res: Response) => {
  try {
    const payment = await paymentLedgerService.findById(param(req, "id"));
    if (payment.userId !== req.user!.id && req.user!.role !== UserRole.ADMIN) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    res.json({ success: true, data: payment });
  } catch (e: any) { res.status(404).json({ success: false, message: e.message }); }
};

// GET /payments — admin only
export const listPayments = async (req: Request, res: Response) => {
  const { status, type, provider, userId, from, to } = req.query;

  if (status !== undefined && !Object.values(PaymentStatus).includes(status as PaymentStatus)) {
    return res.status(400).json({ success: false, message: `Invalid status filter: "${status}"` });
  }
  if (type !== undefined && !Object.values(PaymentType).includes(type as PaymentType)) {
    return res.status(400).json({ success: false, message: `Invalid type filter: "${type}"` });
  }
  if (provider !== undefined && !Object.values(PaymentProvider).includes(provider as PaymentProvider)) {
    return res.status(400).json({ success: false, message: `Invalid provider filter: "${provider}"` });
  }

  let fromDate: Date | undefined;
  let toDate: Date | undefined;
  if (from !== undefined) {
    fromDate = new Date(from as string);
    if (isNaN(fromDate.getTime())) {
      return res.status(400).json({ success: false, message: `Invalid "from" date: "${from}"` });
    }
  }
  if (to !== undefined) {
    toDate = new Date(to as string);
    if (isNaN(toDate.getTime())) {
      return res.status(400).json({ success: false, message: `Invalid "to" date: "${to}"` });
    }
  }

  const { page, limit } = parsePagination(req);
  const data = await paymentLedgerService.listAll({
    status: status as PaymentStatus | undefined,
    type: type as PaymentType | undefined,
    provider: provider as PaymentProvider | undefined,
    userId: userId as string | undefined,
    from: fromDate,
    to: toDate,
    page,
    limit,
  });
  res.json({ success: true, data });
};

// PATCH /payments/:id/status — admin only, manual override
export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { status, reason } = req.body;
    const payment = await paymentLedgerService.setStatus(param(req, "id"), status, reason);
    res.json({ success: true, data: payment });
  } catch (e: any) { res.status(400).json({ success: false, message: e.message }); }
};

// POST /payments/:id/refund — admin only
export const refundPayment = async (req: Request, res: Response) => {
  try {
    const payment = await paymentLedgerService.findById(param(req, "id"));
    if (payment.status !== PaymentStatus.PAID) {
      return res.status(400).json({ success: false, message: `Cannot refund a payment with status "${payment.status}"` });
    }
    if (!payment.providerReference) {
      return res.status(400).json({ success: false, message: "This payment has no gateway reference to refund against" });
    }

    const gateway = payment.provider === PaymentProvider.STRIPE ? new StripeGateway() : new PaystackGateway();
    const result = gateway.refund ? await gateway.refund(payment.providerReference) : { success: false, stubbed: true };
    if (!result.success) {
      return res.status(502).json({ success: false, message: "Gateway refund failed — payment left as PAID, nothing changed" });
    }

    // A stubbed "success" means the gateway isn't configured — no money
    // actually moved. Refusing by default rather than silently marking the
    // ledger REFUNDED, since that would tell an admin a refund happened
    // when it didn't (unlike other stubs in this codebase, which just
    // visibly do nothing — this one would look like it worked). Callers
    // that genuinely want the ledger moved to REFUNDED without a real
    // gateway call (local dev, or a refund already handled manually/outside
    // this system) must say so explicitly.
    if (result.stubbed && req.body?.acknowledgeStub !== true) {
      return res.status(409).json({
        success: false,
        message:
          `${payment.provider} is not configured — no real refund was issued. ` +
          'Pass { "acknowledgeStub": true } to force the ledger to REFUNDED anyway ' +
          "(e.g. for a manual/offline refund), or configure the gateway credentials to issue a real one.",
      });
    }

    const updated = await paymentLedgerService.setStatus(payment.id, PaymentStatus.REFUNDED, req.body?.reason);
    res.json({ success: true, data: updated, gatewayStubbed: result.stubbed });
  } catch (e: any) { res.status(400).json({ success: false, message: e.message }); }
};

// DELETE /payments/:id — admin only, soft delete (keeps the audit trail)
export const removePayment = async (req: Request, res: Response) => {
  try {
    await paymentLedgerService.softDelete(param(req, "id"));
    res.json({ success: true, message: "Payment record removed" });
  } catch (e: any) { res.status(404).json({ success: false, message: e.message }); }
};
// These handlers are kept here for reference but are NOT registered in
// paymentRoutes.ts. The live webhook endpoints are:
//   POST /api/v1/webhooks/stripe   → WebhookController.stripe
//   POST /api/v1/webhooks/paystack → WebhookController.paystack
export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  try {
    const valid = await service.verifyStripeWebhook(req.body as Buffer, sig);
    if (!valid) return res.status(400).json({ message: "Invalid signature" });
    await service.handleStripeWebhook(req.body);
    res.json({ received: true });
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const paystackWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["x-paystack-signature"] as string;
  try {
    const valid = await service.verifyPaystackWebhook(req.body as Buffer, sig);
    if (!valid) return res.status(400).json({ message: "Invalid signature" });
    await service.handlePaystackWebhook(req.body);
    res.json({ received: true });
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};
