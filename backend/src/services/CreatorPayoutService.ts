import Stripe from "stripe";
import { AppDataSource } from "../config/database.js";
import { User } from "../entities/User.js";
import logger from "../utils/logger.js";

/**
 * Real Stripe Connect (Express) onboarding for creator payouts.
 *
 * This is a different Stripe product from checkout (StripeGateway /
 * PaymentIntents) — Connect is about paying creators out, not charging
 * learners. Flow: initiateConnect creates (or reuses) a Stripe Express
 * account for the creator and returns a real Stripe-hosted onboarding link.
 * The creator completes KYC/bank details on Stripe's own site, which
 * redirects back to your frontend's return_url. Per Stripe's own guidance,
 * that redirect firing isn't proof onboarding actually finished — both
 * completeConnect and status re-fetch the account from Stripe and check its
 * real capabilities rather than trusting the redirect alone.
 */
export class CreatorPayoutService {
  private userRepo = AppDataSource.getRepository(User);
  private stripe: Stripe | null;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    this.stripe = key ? new Stripe(key) : null;
    if (!key) {
      logger.warn("[CreatorPayoutService] STRIPE_SECRET_KEY not set — Connect onboarding will fail until it is.");
    }
  }

  async initiateConnect(userId: string, email: string) {
    if (!this.stripe) throw new Error("Stripe is not configured — set STRIPE_SECRET_KEY");

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new Error("User not found");

    let accountId = user.creatorPayoutAccountId;
    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: "express",
        email,
        capabilities: { transfers: { requested: true } },
      });
      accountId = account.id;
      await this.userRepo.update(userId, { creatorPayoutAccountId: accountId });
    }

    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/creator/payout/refresh`,
      return_url: `${baseUrl}/creator/payout/complete`,
      type: "account_onboarding",
    });

    return { redirectUrl: accountLink.url, payoutAccountId: accountId };
  }

  /** Called when Stripe redirects the creator back after onboarding (or any time you want a fresh check). */
  async completeConnect(userId: string) {
    if (!this.stripe) throw new Error("Stripe is not configured — set STRIPE_SECRET_KEY");

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user?.creatorPayoutAccountId) {
      throw new Error("No payout onboarding in progress — call connect first");
    }

    const account = await this.stripe.accounts.retrieve(user.creatorPayoutAccountId);
    const connected = Boolean(account.details_submitted && account.charges_enabled);
    await this.userRepo.update(userId, { creatorPayoutConnected: connected });

    return {
      connected,
      payoutAccountId: account.id,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    };
  }

  async status(userId: string) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user?.creatorPayoutAccountId) {
      return { connected: false, payoutAccountId: null };
    }

    // Live re-check against Stripe rather than only trusting the cached
    // flag — Connect account state can change asynchronously (e.g. Stripe
    // requesting more KYC info after the fact).
    if (this.stripe) {
      try {
        const account = await this.stripe.accounts.retrieve(user.creatorPayoutAccountId);
        const connected = Boolean(account.details_submitted && account.charges_enabled);
        if (connected !== user.creatorPayoutConnected) {
          await this.userRepo.update(userId, { creatorPayoutConnected: connected });
        }
        return {
          connected,
          payoutAccountId: account.id,
          detailsSubmitted: account.details_submitted,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
        };
      } catch (err) {
        logger.error("[CreatorPayoutService] Failed to refresh account status from Stripe", err);
      }
    }

    return {
      connected: user.creatorPayoutConnected ?? false,
      payoutAccountId: user.creatorPayoutAccountId,
    };
  }
}
