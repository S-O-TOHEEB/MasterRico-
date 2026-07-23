import { AppDataSource } from "../config/database.js";
import { Payment, PaymentStatus, PaymentType, PaymentProvider } from "../entities/Payment.js";
import logger from "../utils/logger.js";

export interface RecordPaymentDto {
  userId: string;
  type: PaymentType;
  provider: PaymentProvider;
  amountPence: number;
  currency: string;
  referenceId?: string;
  providerReference?: string;
  metadata?: Record<string, unknown>;
}

export interface ListPaymentsFilter {
  status?: PaymentStatus;
  type?: PaymentType;
  provider?: PaymentProvider;
  userId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]:   [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
  [PaymentStatus.PAID]:      [PaymentStatus.REFUNDED],
  [PaymentStatus.FAILED]:    [PaymentStatus.PENDING], // allow a manual retry to be re-opened
  [PaymentStatus.REFUNDED]:  [],
  [PaymentStatus.CANCELLED]: [PaymentStatus.PENDING],
};

export class PaymentLedgerService {
  private repo = AppDataSource.getRepository(Payment);

  /** Called by PaymentOrchestrator right after a gateway confirms a payment intent was created. */
  async record(dto: RecordPaymentDto): Promise<Payment> {
    const payment = this.repo.create({
      userId: dto.userId,
      type: dto.type,
      provider: dto.provider,
      amountPence: dto.amountPence,
      currency: dto.currency,
      referenceId: dto.referenceId,
      providerReference: dto.providerReference,
      metadata: dto.metadata,
      status: PaymentStatus.PENDING,
    });
    return this.repo.save(payment);
  }

  /** Backfills referenceId once the caller's own record (enrollment/subscription/etc.) exists. */
  async attachReference(paymentId: string, referenceId: string): Promise<void> {
    await this.repo.update({ id: paymentId }, { referenceId });
  }

  async markPaidByReference(type: PaymentType, referenceId: string, providerReference?: string): Promise<void> {
    await this.transition({ type, referenceId }, PaymentStatus.PAID, undefined, providerReference);
  }

  async markFailedByReference(
    type: PaymentType, referenceId: string, reason?: string, providerReference?: string
  ): Promise<void> {
    await this.transition({ type, referenceId }, PaymentStatus.FAILED, reason, providerReference);
  }

  private async transition(
    where: { type: PaymentType; referenceId: string },
    status: PaymentStatus,
    reason?: string,
    providerReference?: string
  ): Promise<void> {
    // Prefer an exact match on the specific gateway transaction this
    // webhook event is actually about. "Most recent for this reference" is
    // only a fallback for callers that don't have one, and is vulnerable to
    // picking the wrong row on a retry: e.g. a card gets declined (attempt
    // A -> FAILED), the user retries and it succeeds (attempt B -> PAID),
    // then attempt A's failure webhook finally arrives late — "most recent"
    // would find attempt B and could flip an already-successful payment
    // back to FAILED.
    const payment = providerReference
      ? await this.repo.findOne({ where: { ...where, providerReference } })
      : await this.repo.findOne({ where, order: { createdAt: "DESC" } });

    if (!payment) {
      logger.info(
        `[PaymentLedgerService] No ledger row found for ${where.type}/${where.referenceId}` +
          `${providerReference ? `/${providerReference}` : ""} — skipping status update`
      );
      return;
    }

    // Idempotency: a duplicate webhook delivery shouldn't re-transition an
    // already-matching row.
    if (payment.status === status) return;

    // Same state-machine guard setStatus() enforces for the admin-facing
    // path — a webhook is generally trustworthy (signature-verified before
    // this is ever called), but delivery order isn't guaranteed by any
    // gateway, so a stale/out-of-order event still shouldn't be able to
    // force an invalid transition (e.g. PAID -> FAILED).
    const allowed = VALID_TRANSITIONS[payment.status];
    if (!allowed.includes(status)) {
      logger.warn(
        `[PaymentLedgerService] Ignoring webhook-driven transition from "${payment.status}" to ` +
          `"${status}" for payment ${payment.id} — not a valid state change (likely a stale/out-of-order event)`
      );
      return;
    }

    payment.status = status;
    if (reason) payment.failureReason = reason;
    await this.repo.save(payment);
  }

  // ── Admin / owner-facing operations ─────────────────────────────────────

  async findById(id: string): Promise<Payment> {
    const payment = await this.repo.findOneBy({ id });
    if (!payment) throw new Error("Payment not found");
    return payment;
  }

  async listForUser(userId: string, page = 1, limit = 20) {
    const [payments, total] = await this.repo.findAndCount({
      where: { userId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { payments, total, page, totalPages: Math.ceil(total / limit) };
  }

  async listAll(filter: ListPaymentsFilter) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.repo.createQueryBuilder("payment");
    if (filter.status)   qb.andWhere("payment.status = :status", { status: filter.status });
    if (filter.type)     qb.andWhere("payment.type = :type", { type: filter.type });
    if (filter.provider) qb.andWhere("payment.provider = :provider", { provider: filter.provider });
    if (filter.userId)   qb.andWhere("payment.userId = :userId", { userId: filter.userId });
    if (filter.from)     qb.andWhere("payment.createdAt >= :from", { from: filter.from });
    if (filter.to)       qb.andWhere("payment.createdAt <= :to", { to: filter.to });

    qb.orderBy("payment.createdAt", "DESC").skip((page - 1) * limit).take(limit);

    const [payments, total] = await qb.getManyAndCount();
    return { payments, total, page, totalPages: Math.ceil(total / limit) };
  }

  /** Manual admin override — validated against a small state machine so e.g. a REFUNDED row can't silently become PENDING again. */
  async setStatus(id: string, status: PaymentStatus, reason?: string): Promise<Payment> {
    const payment = await this.findById(id);
    const allowed = VALID_TRANSITIONS[payment.status];
    if (!allowed.includes(status)) {
      throw new Error(`Cannot move a payment from "${payment.status}" to "${status}"`);
    }
    payment.status = status;
    if (reason) payment.failureReason = reason;
    return this.repo.save(payment);
  }

  async softDelete(id: string): Promise<void> {
    const payment = await this.findById(id);
    await this.repo.softRemove(payment);
  }
}

export const paymentLedgerService = new PaymentLedgerService();
