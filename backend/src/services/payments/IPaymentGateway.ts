export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed";
  clientSecret?: string; // For Stripe
  authorizationUrl?: string; // For Paystack
}

export interface IPaymentGateway {
  createPaymentIntent(amount: number, currency: string, email: string, metadata: any): Promise<PaymentIntent>;
  verifyWebhook(payload: any, signature: string): Promise<boolean>;
  handleWebhook(payload: any): Promise<void>;
  /** Optional — not every gateway implementation needs to support this immediately. */
  refund?(providerReference: string): Promise<{ success: boolean; stubbed: boolean }>;
}
