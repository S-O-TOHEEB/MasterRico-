import type { IPaymentGateway } from "./IPaymentGateway.js";
import { PaystackGateway } from "./PaystackGateway.js";
import { StripeGateway } from "./StripeGateway.js";
import { paymentLedgerService } from "../PaymentLedgerService.js";
import { PaymentType, PaymentProvider } from "../../entities/Payment.js";
import logger from "../../utils/logger.js";

export class PaymentOrchestrator {
  private gateways: { paystack: IPaymentGateway; stripe: IPaymentGateway } = {
    paystack: new PaystackGateway(),
    stripe: new StripeGateway(),
  };

  /**
   * Routes the payment to the appropriate gateway based on currency or region
   */
  getGateway(currency: string): IPaymentGateway {
    const africanCurrencies = ["NGN", "GHS", "ZAR", "KES"];
    if (africanCurrencies.includes(currency.toUpperCase())) {
      return this.gateways.paystack;
    }
    return this.gateways.stripe;
  }

  private providerFor(currency: string): PaymentProvider {
    return this.getGateway(currency) === this.gateways.paystack
      ? PaymentProvider.PAYSTACK
      : PaymentProvider.STRIPE;
  }

  /**
   * metadata is expected to carry:
   *   - userId (or adminUserId, for corporate purchases)
   *   - type: one of PaymentType — which flow this payment belongs to
   *   - an id field identifying the caller's own record (enrollmentId /
   *     subscriptionId / corporateAccountId) — every current call site
   *     creates that record before calling this, so referenceId is always
   *     available immediately here (verified certificates are the one
   *     exception — that record doesn't exist until after payment, so its
   *     ledger row is created without a referenceId and stays that way)
   *
   * Every payment flow in the app goes through this one method, so this is
   * the single place a Payment ledger row gets created — see
   * PaymentLedgerService for the read/query side (GET /payments/*).
   */
  async initializePayment(amount: number, currency: string, email: string, metadata: any) {
    const gateway = this.getGateway(currency);
    const intent = await gateway.createPaymentIntent(amount, currency, email, metadata);

    let ledgerId: string | undefined;
    try {
      const userId = metadata?.userId ?? metadata?.adminUserId;
      const type: PaymentType = metadata?.type ?? PaymentType.OTHER;
      const referenceId =
        metadata?.enrollmentId ?? metadata?.subscriptionId ??
        metadata?.corporateAccountId ?? undefined;

      if (userId) {
        const payment = await paymentLedgerService.record({
          userId,
          type,
          provider: this.providerFor(currency),
          amountPence: amount,
          currency,
          referenceId,
          providerReference: intent.id,
          metadata,
        });
        ledgerId = payment.id;
      } else {
        logger.info("[PaymentOrchestrator] No userId in metadata — skipping ledger record for this payment");
      }
    } catch (error: any) {
      // A ledger-write failure must never break the actual payment flow.
      logger.error(`[PaymentOrchestrator] Failed to record payment ledger entry: ${error.message}`);
    }

    return { ...intent, ledgerId };
  }
}
