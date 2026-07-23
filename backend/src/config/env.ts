import logger from "../utils/logger.js";

// Common defaults from tutorials/boilerplates (including ones that have
// appeared in this very codebase's history) — explicitly rejected even if
// someone does set JWT_SECRET, not just when it's missing.
const INSECURE_JWT_SECRETS = new Set([
  "change-me", "changeme", "secret", "password",
  "your-secret-key", "your-jwt-secret", "jwt-secret",
]);

// Substring check too, so a placeholder that's technically "changed" but
// still obviously unedited (e.g. this project's own .env.example value,
// "change-me-to-a-random-64-char-string") is still caught rather than
// slipping through an exact-match-only blocklist.
const INSECURE_JWT_SECRET_MARKERS = ["change-me", "changeme", "your-secret", "your-jwt"];

/**
 * Single source of truth for reading JWT_SECRET. Throws instead of silently
 * falling back to a known-weak default — a missing env var should fail
 * loudly, not quietly sign every token with a string that's now published
 * in this codebase's own source.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const lower = secret?.toLowerCase();
  const looksLikePlaceholder =
    !secret ||
    secret.length < 16 ||
    (lower && (INSECURE_JWT_SECRETS.has(lower) || INSECURE_JWT_SECRET_MARKERS.some((m) => lower.includes(m))));

  if (looksLikePlaceholder) {
    throw new Error(
      "JWT_SECRET is missing or looks like an unedited placeholder. Set it to a random string of " +
      "at least 16 characters (e.g. `openssl rand -hex 32`) before starting the server."
    );
  }
  return secret!;
}

/**
 * Called once at boot, before the app starts accepting connections. Fails
 * fast with a clear message rather than booting in a silently-insecure
 * state — see getJwtSecret().
 */
export function validateEnv(): void {
  try {
    getJwtSecret();
  } catch (err: any) {
    logger.error(`[Startup] ${err.message}`);
    process.exit(1);
  }
}
