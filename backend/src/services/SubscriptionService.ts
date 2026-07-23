import { AppDataSource } from "../config/database.js";
import { Subscription, SubscriptionPlan, SubscriptionStatus, BillingPeriod } from "../entities/Subscription.js";
import { User, SubscriptionTier } from "../entities/User.js";
import { PaymentOrchestrator } from "./payments/PaymentOrchestrator.js";
import { PaymentType } from "../entities/Payment.js";
import logger from "../utils/logger.js";

// Prices in pence
const PLAN_PRICES: Record<SubscriptionPlan, Record<BillingPeriod, number>> = {
  [SubscriptionPlan.CREATOR_PRO]: {
    [BillingPeriod.MONTHLY]: 2900,   // £29
    [BillingPeriod.ANNUAL]: 29000,   // £290 (~2 months free)
  },
  [SubscriptionPlan.LEARNER_PRO]: {
    [BillingPeriod.MONTHLY]: 999,    // £9.99
    [BillingPeriod.ANNUAL]: 7999,    // £79.99
  },
};

export class SubscriptionService {
  private subscriptionRepo = AppDataSource.getRepository(Subscription);
  private userRepo = AppDataSource.getRepository(User);
  private paymentOrchestrator = new PaymentOrchestrator();

  async getCurrent(userId: string): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Initialise a subscription payment.
   * The subscription record is created in TRIALING state; becomes ACTIVE on webhook.
   */
  async initiate(
    userId: string,
    plan: SubscriptionPlan,
    billingPeriod: BillingPeriod,
    email: string,
    currency = "GBP"
  ) {
    const existing = await this.getCurrent(userId);
    if (existing?.plan === plan) throw new Error("Already subscribed to this plan");

    const amount = PLAN_PRICES[plan][billingPeriod];

    const periodEnd = new Date();
    billingPeriod === BillingPeriod.ANNUAL
      ? periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      : periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = this.subscriptionRepo.create({
      userId,
      plan,
      billingPeriod,
      status: SubscriptionStatus.TRIALING,
      amountPence: amount,
      currency,
      currentPeriodEnd: periodEnd,
    });
    const saved = await this.subscriptionRepo.save(subscription);

    const intent = await this.paymentOrchestrator.initializePayment(
      amount,
      currency,
      email,
      { type: PaymentType.SUBSCRIPTION, subscriptionId: saved.id, userId, plan, billingPeriod }
    );

    return { subscription: saved, paymentIntent: intent };
  }

  /**
   * Called by WebhookService when a subscription payment succeeds.
   */
  async activate(
    subscriptionId: string,
    gatewayRef: string,
    gateway: "stripe" | "paystack"
  ): Promise<void> {
    const sub = await this.subscriptionRepo.findOneBy({ id: subscriptionId });
    if (!sub) return;

    sub.status = SubscriptionStatus.ACTIVE;
    if (gateway === "stripe") sub.stripeSubscriptionId = gatewayRef;
    else sub.paystackSubscriptionCode = gatewayRef;

    await this.subscriptionRepo.save(sub);

    // Keep user.subscriptionTier in sync
    const tier =
      sub.plan === SubscriptionPlan.CREATOR_PRO
        ? SubscriptionTier.CREATOR_PRO
        : SubscriptionTier.LEARNER_PRO;
    await this.userRepo.update(sub.userId, { subscriptionTier: tier });

    logger.info(`[SubscriptionService] Activated ${sub.plan} for user ${sub.userId}`);
  }

  async cancel(userId: string): Promise<Subscription> {
    const sub = await this.getCurrent(userId);
    if (!sub) throw new Error("No active subscription");
    sub.cancelAtPeriodEnd = true;
    return this.subscriptionRepo.save(sub);
  }

  /**
   * Called at period end by webhook — deactivates and resets tier.
   */
  async expire(subscriptionId: string): Promise<void> {
    const sub = await this.subscriptionRepo.findOneBy({ id: subscriptionId });
    if (!sub) return;
    sub.status = SubscriptionStatus.CANCELLED;
    await this.subscriptionRepo.save(sub);
    await this.userRepo.update(sub.userId, { subscriptionTier: SubscriptionTier.FREE });
  }
}
