import { AppDataSource } from "../config/database.js";
import { UserStreak } from "../entities/UserStreak.js";
import { Badge, BadgeSlug, UserBadge } from "../entities/Badge.js";
import { NotificationService } from "./NotificationService.js";
import { NotificationType } from "../entities/Notification.js";
import logger from "../utils/logger.js";

export class StreakBadgeService {
  private streakRepo    = AppDataSource.getRepository(UserStreak);
  private badgeRepo     = AppDataSource.getRepository(Badge);
  private userBadgeRepo = AppDataSource.getRepository(UserBadge);
  private notifService  = new NotificationService();

  // ── Streaks ──────────────────────────────────────────────────────────────────

  /**
   * Called every time a learner completes a lesson.
   * Maintains consecutive-day streak logic and triggers badge checks.
   */
  async recordActivity(userId: string): Promise<UserStreak> {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    let streak = await this.streakRepo.findOneBy({ userId });
    if (!streak) {
      streak = this.streakRepo.create({
        userId, currentStreak: 0, longestStreak: 0, totalActiveDays: 0,
      });
    }

    // Already recorded today — idempotent
    if (streak.lastActivityDate === today) return streak;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (streak.lastActivityDate === yesterdayStr) {
      streak.currentStreak++;
    } else {
      // Streak broken — restart
      streak.currentStreak = 1;
    }

    streak.lastActivityDate = today;
    streak.totalActiveDays++;

    if (streak.currentStreak > streak.longestStreak) {
      streak.longestStreak = streak.currentStreak;
    }

    const saved = await this.streakRepo.save(streak);
    await this.checkStreakBadges(userId, saved.currentStreak);
    return saved;
  }

  async getStreak(userId: string): Promise<UserStreak | null> {
    return this.streakRepo.findOneBy({ userId });
  }

  // ── Badges ───────────────────────────────────────────────────────────────────

  async awardBadge(userId: string, slug: BadgeSlug): Promise<UserBadge | null> {
    const badge = await this.badgeRepo.findOneBy({ slug });
    if (!badge) {
      logger.warn(`[StreakBadgeService] Badge not found: ${slug}`);
      return null;
    }

    // Idempotent — don't award twice
    const existing = await this.userBadgeRepo.findOne({
      where: { userId, badgeId: badge.id },
    });
    if (existing) return existing;

    const userBadge = this.userBadgeRepo.create({ userId, badgeId: badge.id });
    const saved     = await this.userBadgeRepo.save(userBadge);

    await this.notifService.create(userId, {
      type:         NotificationType.SYSTEM,
      title:        `🏅 Badge Earned: ${badge.name}`,
      message:      badge.description,
      resourceId:   badge.id,
      resourceType: "badge",
    });

    logger.info(`[StreakBadgeService] Awarded ${slug} to user ${userId}`);
    return saved;
  }

  async listUserBadges(userId: string): Promise<UserBadge[]> {
    return this.userBadgeRepo.find({
      where: { userId },
      relations: ["badge"],
      order: { awardedAt: "DESC" },
    });
  }

  async listAllBadges(): Promise<Badge[]> {
    return this.badgeRepo.find({ order: { tier: "ASC" } });
  }

  /**
   * Master check — call after any significant learner action.
   * Checks which badges should now be awarded based on current stats.
   */
  async checkAndAwardBadges(
    userId: string,
    context: {
      enrollmentCount?:  number;
      completionCount?:  number;
      reviewCount?:      number;
      discussionCount?:  number;
      acceptedAnswers?:  number;
      coursesPublished?: number;
      totalStudents?:    number;
      referralCount?:    number;
    },
  ): Promise<void> {
    const {
      enrollmentCount, completionCount, reviewCount,
      discussionCount, acceptedAnswers, coursesPublished,
      totalStudents, referralCount,
    } = context;

    if (enrollmentCount === 1)  await this.awardBadge(userId, BadgeSlug.FIRST_ENROLLMENT);
    if (completionCount === 1)  await this.awardBadge(userId, BadgeSlug.FIRST_COMPLETION);
    if (completionCount === 3)  await this.awardBadge(userId, BadgeSlug.COURSES_3);
    if (completionCount === 10) await this.awardBadge(userId, BadgeSlug.COURSES_10);
    if (reviewCount === 1)      await this.awardBadge(userId, BadgeSlug.FIRST_REVIEW);
    if (discussionCount === 1)  await this.awardBadge(userId, BadgeSlug.FIRST_DISCUSSION);
    if (acceptedAnswers === 1)  await this.awardBadge(userId, BadgeSlug.HELPFUL_ANSWER);
    if (coursesPublished === 1) await this.awardBadge(userId, BadgeSlug.CREATOR_PUBLISHED);
    if (totalStudents === 10)   await this.awardBadge(userId, BadgeSlug.CREATOR_10_STUDENTS);
    if (referralCount === 1)    await this.awardBadge(userId, BadgeSlug.REFERRAL_FIRST);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async checkStreakBadges(userId: string, streak: number): Promise<void> {
    if (streak >= 7)  await this.awardBadge(userId, BadgeSlug.STREAK_7);
    if (streak >= 30) await this.awardBadge(userId, BadgeSlug.STREAK_30);
  }
}
