import { AppDataSource } from "../config/database.js";
import {
  ReferralCode, ReferralConversion,
  ReferralStatus, ReferralRewardType,
} from "../entities/ReferralCode.js";
import { User, SubscriptionTier } from "../entities/User.js";
import { StreakBadgeService } from "./StreakBadgeService.js";
import { BadgeSlug } from "../entities/Badge.js";
import logger from "../utils/logger.js";

export class ReferralService {
  private codeRepo        = AppDataSource.getRepository(ReferralCode);
  private conversionRepo  = AppDataSource.getRepository(ReferralConversion);
  private userRepo        = AppDataSource.getRepository(User);
  private streakBadge     = new StreakBadgeService();

  /**
   * Auto-generate a referral code for a new user on registration.
   * Format: first 5 letters of name + 4 random hex chars — e.g. JANEDO-A3F2
   */
  async createForUser(userId: string): Promise<ReferralCode> {
    const existing = await this.codeRepo.findOneBy({ ownerId: userId });
    if (existing) return existing;

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new Error("User not found");

    const namePart = (user.firstName + user.lastName)
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 6)
      .padEnd(3, "X");

    let code: string;
    let attempts = 0;
    do {
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      code = `${namePart}-${rand}`;
      attempts++;
      if (attempts > 10) code = `REF-${userId.slice(0, 8).toUpperCase()}`;
    } while (await this.codeRepo.findOneBy({ code }));

    const ref = this.codeRepo.create({ ownerId: userId, code });
    return this.codeRepo.save(ref);
  }

  async getMyCode(userId: string): Promise<ReferralCode> {
    const code = await this.codeRepo.findOneBy({ ownerId: userId });
    if (!code) return this.createForUser(userId);
    return code;
  }

  /**
   * Called on registration when a new user provides a referral code.
   * Creates a PENDING conversion — converted when they make their first payment.
   */
  async applyCode(code: string, newUserId: string): Promise<void> {
    const refCode = await this.codeRepo.findOneBy({ code: code.toUpperCase(), isActive: true });
    if (!refCode) return; // Silently ignore invalid codes — don't block registration

    if (refCode.ownerId === newUserId) return; // Can't refer yourself

    const existing = await this.conversionRepo.findOneBy({ referredUserId: newUserId });
    if (existing) return; // Already used a code

    await this.conversionRepo.save(
      this.conversionRepo.create({
        referralCodeId:  refCode.id,
        referredUserId:  newUserId,
        status:          ReferralStatus.PENDING,
        rewardType:      ReferralRewardType.FREE_PRO_MONTH,
        rewardAmountPence: 0,
      }),
    );

    logger.info(`[ReferralService] Code ${code} applied by user ${newUserId}`);
  }

  /**
   * Call this when a referred user makes their first paid purchase.
   * Marks the conversion and queues the reward for the referrer.
   */
  async convertReferral(referredUserId: string): Promise<void> {
    const conversion = await this.conversionRepo.findOne({
      where: { referredUserId, status: ReferralStatus.PENDING },
      relations: ["referralCode"],
    });
    if (!conversion) return;

    conversion.status = ReferralStatus.CONVERTED;
    await this.conversionRepo.save(conversion);

    await this.codeRepo.increment(
      { id: conversion.referralCodeId }, "totalConversions", 1,
    );

    // Apply reward to referrer — 1 free month Pro
    await this.applyReward(conversion);

    // Badge for first successful referral
    const referrerConversions = await this.conversionRepo.countBy({
      referralCodeId: conversion.referralCodeId,
      status:         ReferralStatus.REWARDED,
    });
    if (referrerConversions === 1) {
      await this.streakBadge.awardBadge(
        conversion.referralCode.ownerId, BadgeSlug.REFERRAL_FIRST,
      );
    }
  }

  async getStats(userId: string) {
    const code = await this.codeRepo.findOneBy({ ownerId: userId });
    if (!code) return { code: null, totalConversions: 0, conversions: [] };

    const conversions = await this.conversionRepo.find({
      where: { referralCodeId: code.id },
      relations: ["referredUser"],
      order: { createdAt: "DESC" },
    });

    return {
      code:              code.code,
      totalConversions:  code.totalConversions,
      conversions: conversions.map(c => ({
        referredName: `${c.referredUser.firstName} ${c.referredUser.lastName}`,
        status:       c.status,
        rewardApplied: c.rewardApplied,
        date:         c.createdAt,
      })),
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async applyReward(conversion: ReferralConversion): Promise<void> {
    if (conversion.rewardType === ReferralRewardType.FREE_PRO_MONTH) {
      // Flag for the subscription service to extend the next billing period
      // by 30 days. Actual extension happens in SubscriptionService.
      conversion.status        = ReferralStatus.REWARDED;
      conversion.rewardApplied = true;
      await this.conversionRepo.save(conversion);
      logger.info(
        `[ReferralService] Free Pro month reward flagged for ` +
        `user ${conversion.referralCode.ownerId}`,
      );
    }
  }
}
