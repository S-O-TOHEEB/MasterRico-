import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/database.js";
import { User, UserRole, SubscriptionTier } from "../entities/User.js";
import { getJwtSecret } from "../config/env.js";

interface TokenPayload {
  id: string;
  email: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  interests?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

const userRepo = () => AppDataSource.getRepository(User);

/**
 * Re-checks isActive/role/subscriptionTier against the DB rather than
 * trusting the JWT's claims for the remainder of its lifetime (up to 7
 * days by default). Without this, deactivating a user, banning them, or
 * changing their role/tier had no effect on a token issued before the
 * change — they'd keep acting under the old privileges until the token
 * naturally expired. This adds one query per authenticated request; there's
 * no caching layer in this app to soften that yet, so it's a real, accepted
 * cost for closing an otherwise-persistent privilege window.
 */
async function loadActiveUser(userId: string): Promise<Pick<User, "id" | "isActive" | "role" | "subscriptionTier"> | null> {
  const user = await userRepo().findOne({
    where: { id: userId },
    select: ["id", "isActive", "role", "subscriptionTier"],
  });
  return user && user.isActive ? user : null;
}

/** Require valid JWT — 401 if missing, invalid, or the account is no longer active */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(
      token!,
      getJwtSecret()
    ) as TokenPayload;

    const current = await loadActiveUser(decoded.id);
    if (!current) {
      res.status(401).json({ success: false, message: "Account is no longer active" });
      return;
    }

    // Trust the DB for anything that can change after the token was
    // issued (role, tier, active status); the token is still the source of
    // truth for identity/email since those don't change out from under a
    // session the same way.
    req.user = { ...decoded, role: current.role, subscriptionTier: current.subscriptionTier };
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

/**
 * Attach user from JWT when present, but do NOT reject anonymous requests.
 * Used for search — authenticated users get trust-graph boosts.
 */
export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(
        token!,
        getJwtSecret()
      ) as TokenPayload;
      const current = await loadActiveUser(decoded.id);
      if (current) {
        req.user = { ...decoded, role: current.role, subscriptionTier: current.subscriptionTier };
      }
      // Deactivated/missing user: fall through as anonymous rather than
      // rejecting, matching this middleware's "optional" contract.
    } catch {
      // Silently ignore invalid tokens in optional mode
    }
  }
  next();
};

/** Role guard — must follow authenticate */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }
    next();
  };
};
