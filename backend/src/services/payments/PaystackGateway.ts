import axios from "axios";
import crypto from "crypto";
import { type IPaymentGateway, type PaymentIntent } from "./IPaymentGateway.js";
import logger from "../../utils/logger.js";

export class PaystackGateway implements IPaymentGateway {
  private readonly secretKey = process.env.PAYSTACK_SECRET_KEY;

  async createPaymentIntent(amount: number, currency: string, email: string, metadata: any): Promise<PaymentIntent> {
    try {
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          amount: amount, // Paystack expects kobo/cents
          currency,
          metadata,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );

      return {
        id: response.data.data.reference,
        amount,
        currency,
        status: "pending",
        authorizationUrl: response.data.data.authorization_url,
      };
    } catch (error: any) {
      logger.error("Paystack Payment Initialization Failed", error.response?.data || error.message);
      throw new Error("Payment initialization failed");
    }
  }

  /** Real refund via Paystack's Refund API. Falls back to a labelled stub
   *  when Paystack isn't configured, same reasoning as StripeGateway.refund. */
  async refund(providerReference: string): Promise<{ success: boolean; stubbed: boolean }> {
    if (!this.secretKey) {
      logger.info(`[PaystackGateway] STUB (no PAYSTACK_SECRET_KEY set) — would refund transaction ${providerReference}`);
      return { success: true, stubbed: true };
    }
    try {
      await axios.post(
        "https://api.paystack.co/refund",
        { transaction: providerReference },
        { headers: { Authorization: `Bearer ${this.secretKey}` } }
      );
      return { success: true, stubbed: false };
    } catch (error: any) {
      logger.error("[PaystackGateway] Refund failed", error.response?.data || error.message);
      return { success: false, stubbed: false };
    }
  }

  async verifyWebhook(payload: any, signature: string): Promise<boolean> {
    if (!this.secretKey || !signature) {
      return false;
    }

    // NOTE: Paystack signs the exact raw request body bytes. The route that
    // calls this must capture the raw body (e.g. express.raw()) for this
    // hash to match — re-serializing a parsed JSON object can change byte
    // order/whitespace and produce a false negative.
    const rawBody = typeof payload === "string" ? payload : JSON.stringify(payload);
    const expectedHash = crypto.createHmac("sha512", this.secretKey).update(rawBody).digest("hex");

    try {
      return crypto.timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(signature, "hex"));
    } catch {
      // Buffer length mismatch, non-hex signature, etc. -> treat as invalid
      return false;
    }
  }

  async handleWebhook(payload: any): Promise<void> {
    // Logic to update payment status in DB based on Paystack event
    logger.info("Handling Paystack Webhook", payload.event);
  }
}
