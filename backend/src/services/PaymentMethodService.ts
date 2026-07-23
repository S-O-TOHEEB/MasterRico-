import Stripe from "stripe";
import axios from "axios";
import { AppDataSource } from "../config/database.js";
import { PaymentMethod, PaymentMethodProvider } from "../entities/PaymentMethod.js";
import { User } from "../entities/User.js";
import logger from "../utils/logger.js";

export interface AddPaymentMethodDto {
  provider: PaymentMethodProvider;
  /** Stripe: a pm_xxx id created client-side via Stripe.js/Elements — the raw
   *  card never touches this backend. */
  stripePaymentMethodId?: string;
  /** Paystack: the reference from a completed Paystack Popup/Inline charge —
   *  verified server-side below, which is also where the reusable
   *  authorization_code and real card details come from. */
  paystackReference?: string;
  makeDefault?: boolean;
}

interface VerifiedCard {
  externalId: string;
  brand?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

const PAYSTACK_API = "https://api.paystack.co";

/**
 * Real card verification for both gateways. Neither branch trusts
 * client-asserted brand/last4/expiry — both re-derive those from the
 * gateway's own response, since a client could otherwise claim to be saving
 * a Visa ending in 4242 when the actual token/reference says something else.
 */
export class PaymentMethodService {
  private repo = AppDataSource.getRepository(PaymentMethod);
  private userRepo = AppDataSource.getRepository(User);
  private stripe: Stripe | null;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    this.stripe = key ? new Stripe(key) : null;
    if (!key) {
      logger.warn("[PaymentMethodService] STRIPE_SECRET_KEY not set — adding Stripe payment methods will fail until it is.");
    }
  }

  async list(userId: string): Promise<PaymentMethod[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: "DESC" } });
  }

  async add(userId: string, dto: AddPaymentMethodDto): Promise<PaymentMethod> {
    if (!dto.provider) throw new Error("provider is required");

    const verified =
      dto.provider === PaymentMethodProvider.STRIPE
        ? await this.verifyAndAttachStripe(userId, dto)
        : await this.verifyPaystack(dto);

    const existingCount = await this.repo.countBy({ userId });
    const shouldBeDefault = dto.makeDefault ?? existingCount === 0;

    if (shouldBeDefault) {
      await this.repo.update({ userId }, { isDefault: false });
    }

    const pm = this.repo.create({
      userId,
      provider: dto.provider,
      brand: verified.brand,
      last4: verified.last4,
      expiryMonth: verified.expiryMonth,
      expiryYear: verified.expiryYear,
      externalId: verified.externalId,
      isDefault: shouldBeDefault,
    });
    return this.repo.save(pm);
  }

  async remove(userId: string, id: string): Promise<void> {
    const pm = await this.repo.findOneBy({ id, userId });
    if (!pm) throw new Error("Payment method not found");

    // Best-effort: detach from Stripe too so it genuinely can't be charged
    // again after "removal" here, not just hidden from the list.
    if (pm.provider === PaymentMethodProvider.STRIPE && this.stripe && pm.externalId) {
      try {
        await this.stripe.paymentMethods.detach(pm.externalId);
      } catch (err) {
        logger.warn(`[PaymentMethodService] Failed to detach ${pm.externalId} from Stripe (removing locally anyway)`, err);
      }
    }
    // Paystack has no equivalent "revoke this authorization" endpoint in its
    // public API, so there's nothing remote to call for that provider.

    await this.repo.remove(pm);
  }

  async setDefault(userId: string, id: string): Promise<PaymentMethod> {
    const pm = await this.repo.findOneBy({ id, userId });
    if (!pm) throw new Error("Payment method not found");
    await this.repo.update({ userId }, { isDefault: false });
    pm.isDefault = true;
    const saved = await this.repo.save(pm);

    if (pm.provider === PaymentMethodProvider.STRIPE && this.stripe && pm.externalId) {
      const user = await this.userRepo.findOneBy({ id: userId });
      if (user?.stripeCustomerId) {
        try {
          await this.stripe.customers.update(user.stripeCustomerId, {
            invoice_settings: { default_payment_method: pm.externalId },
          });
        } catch (err) {
          logger.warn("[PaymentMethodService] Failed to sync default payment method to Stripe customer", err);
        }
      }
    }

    return saved;
  }

  // ── Private ────────────────────────────────────────────────────────────

  private async verifyAndAttachStripe(userId: string, dto: AddPaymentMethodDto): Promise<VerifiedCard> {
    if (!this.stripe) throw new Error("Stripe is not configured — set STRIPE_SECRET_KEY");
    if (!dto.stripePaymentMethodId) throw new Error("stripePaymentMethodId is required for provider=stripe");

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new Error("User not found");

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({ email: user.email });
      customerId = customer.id;
      await this.userRepo.update(userId, { stripeCustomerId: customerId });
    }

    const attached = await this.stripe.paymentMethods.attach(dto.stripePaymentMethodId, { customer: customerId });
    const card = attached.card;
    if (!card) throw new Error("That payment method has no card details — only cards are supported here");

    return {
      externalId: attached.id,
      brand: card.brand,
      last4: card.last4,
      expiryMonth: card.exp_month,
      expiryYear: card.exp_year,
    };
  }

  private async verifyPaystack(dto: AddPaymentMethodDto): Promise<VerifiedCard> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new Error("Paystack is not configured — set PAYSTACK_SECRET_KEY");
    if (!dto.paystackReference) throw new Error("paystackReference is required for provider=paystack");

    const response = await axios.get(`${PAYSTACK_API}/transaction/verify/${dto.paystackReference}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const data = response.data.data;
    if (data.status !== "success") {
      throw new Error("That Paystack transaction was not successful — can't save this card");
    }

    const auth = data.authorization;
    if (!auth?.reusable || !auth?.authorization_code) {
      throw new Error("This card isn't marked reusable by Paystack, so it can't be saved for future charges");
    }

    return {
      externalId: auth.authorization_code,
      brand: auth.card_type,
      last4: auth.last4,
      expiryMonth: auth.exp_month ? Number(auth.exp_month) : undefined,
      expiryYear: auth.exp_year ? Number(auth.exp_year) : undefined,
    };
  }
}
