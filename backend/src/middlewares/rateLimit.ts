import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

/**
 * Reporting hides content immediately, with no multi-report threshold — see
 * DiscussionService.reportPost/reportReply and ReviewService.report. That's
 * a deliberate trust-and-safety choice (hide fast, let an admin review and
 * unflag if wrong), but it means a single call is an actual moderation
 * action, not just a read. Without a limit, any authenticated user could
 * spam-flag other users' content and silence it faster than admins could
 * reasonably keep up with unflagging it. Keyed by user id (not just IP) so
 * it can't be trivially bypassed by rotating IPs while reusing one account,
 * and so it doesn't accidentally lump together unrelated users behind a
 * shared IP (offices, universities, NAT).
 */
export const reportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? "unknown"),
  message: { success: false, message: "Too many reports submitted — try again later" },
});
