import { PaymentOrchestrator } from "./payments/PaymentOrchestrator.js";

const orchestrator = new PaymentOrchestrator();

export class PaymentService {
  async initializePayment(amount: number, currency: string, email: string, metadata: Record<string, unknown>) {
    return orchestrator.initializePayment(amount, currency, email, metadata);
  }

  async verifyStripeWebhook(payload: Buffer, signature: string): Promise<boolean> {
    const gateway = orchestrator.getGateway("GBP");
    return gateway.verifyWebhook(payload, signature);
  }

  async handleStripeWebhook(payload: unknown): Promise<void> {
    const gateway = orchestrator.getGateway("GBP");
    return gateway.handleWebhook(payload);
  }

  async verifyPaystackWebhook(payload: Buffer, signature: string): Promise<boolean> {
    const gateway = orchestrator.getGateway("NGN");
    return gateway.verifyWebhook(payload, signature);
  }

  async handlePaystackWebhook(payload: unknown): Promise<void> {
    const gateway = orchestrator.getGateway("NGN");
    return gateway.handleWebhook(payload);
  }
}
