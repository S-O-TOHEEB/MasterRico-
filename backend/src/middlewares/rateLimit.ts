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

/**
 * Keys by the *target* email/account, not just IP — a per-IP-only limiter
 * doesn't stop credential stuffing or OTP brute-forcing spread across many
 * IPs, and this app had no rate limiting at all on any auth endpoint before
 * this. Falls back to IP when there's no email in the body yet (shouldn't
 * normally happen given these are only ever applied after body parsing on
 * routes that require email, but fails safe rather than throwing if it did).
 */
function emailKey(req: Request): string {
  const email = (req.body?.email as string | undefined)?.trim().toLowerCase();
  return email ? `email:${email}` : `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}

/** Login — credential stuffing / brute force. */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailKey,
  message: { message: "Too many login attempts — try again later" },
});

/**
 * OTP verification — the sharpest version of this problem. A 6-digit code
 * has only 1,000,000 possibilities; with a 15-minute TTL and no attempt
 * cap, it's brute-forceable well inside that window. 5 attempts per window
 * makes guessing it practically impossible regardless of how many IPs an
 * attacker spreads the guesses across, since this is keyed by the target
 * account, not the source.
 */
export const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailKey,
  message: { message: "Too many attempts — request a new code and try again" },
});

/** Register, resend-otp, password-reset-request — abuse/enumeration-probing prevention, looser than login/OTP since these aren't direct credential-guessing surfaces. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailKey,
  message: { message: "Too many requests — try again later" },
});
