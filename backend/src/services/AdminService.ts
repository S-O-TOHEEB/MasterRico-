import { AppDataSource } from "../config/database.js";
import { User, UserRole } from "../entities/User.js";
import { StreakBadgeService } from "./StreakBadgeService.js";
import { BadgeSlug } from "../entities/Badge.js";
import { ReferralService } from "./ReferralService.js";
import { DiscussionService } from "./DiscussionService.js";
import { ReviewService } from "./ReviewService.js";
import logger from "../utils/logger.js";

export class AdminService {
  private userRepo      = AppDataSource.getRepository(User);
  private streakBadge   = new StreakBadgeService();
  private referralSvc   = new ReferralService();
  private discussionSvc = new DiscussionService();
  private reviewSvc     = new ReviewService();

  /**
   * Mark a creator as a founding member:
   * - 0% platform commission for 6 months from today
   * - Founder badge awarded
   * - Referral code auto-generated
   */
  async grantFounderStatus(targetUserId: string): Promise<User> {
    const user = await this.userRepo.findOneBy({ id: targetUserId });
    if (!user) throw new Error("User not found");
    if (user.role !== UserRole.CREATOR) throw new Error("Only creators can receive founder status");

    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

    user.isFoundingCreator     = true;
    user.founderCommissionUntil = sixMonthsFromNow;
    const saved = await this.userRepo.save(user);

    await this.streakBadge.awardBadge(targetUserId, BadgeSlug.FOUNDER);
    await this.referralSvc.createForUser(targetUserId);

    logger.info(`[AdminService] Founder status granted to ${targetUserId} until ${sixMonthsFromNow.toDateString()}`);
    return saved;
  }

  async revokeFounderStatus(targetUserId: string): Promise<User> {
    const user = await this.userRepo.findOneBy({ id: targetUserId });
    if (!user) throw new Error("User not found");

    user.isFoundingCreator      = false;
    user.founderCommissionUntil = undefined;
    return this.userRepo.save(user);
  }

  async listFoundingCreators(): Promise<User[]> {
    return this.userRepo.find({
      where: { isFoundingCreator: true },
      order: { createdAt: "ASC" },
    });
  }

  // ── Content moderation queue ─────────────────────────────────────────────
  // Thin facade over DiscussionService/ReviewService so AdminController only
  // ever talks to one service, matching its existing style.

  listFlaggedReviews(page: number, limit: number) {
    return this.reviewSvc.listFlagged(page, limit);
  }

  unflagReview(reviewId: string) {
    return this.reviewSvc.unflag(reviewId);
  }

  deleteReview(reviewId: string) {
    return this.reviewSvc.adminDelete(reviewId);
  }

  listFlaggedDiscussionPosts(page: number, limit: number) {
    return this.discussionSvc.listFlaggedPosts(page, limit);
  }

  listFlaggedDiscussionReplies(page: number, limit: number) {
    return this.discussionSvc.listFlaggedReplies(page, limit);
  }

  unflagDiscussionPost(postId: string) {
    return this.discussionSvc.unflagPost(postId);
  }

  unflagDiscussionReply(replyId: string) {
    return this.discussionSvc.unflagReply(replyId);
  }

  deleteDiscussionPost(postId: string) {
    return this.discussionSvc.adminDeletePost(postId);
  }

  deleteDiscussionReply(replyId: string) {
    return this.discussionSvc.adminDeleteReply(replyId);
  }
}
