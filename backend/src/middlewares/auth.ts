import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole, SubscriptionTier } from "../entities/User.js";
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

/** Require valid JWT — 401 if missing or invalid */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

/**
 * Attach user from JWT when present, but do NOT reject anonymous requests.
 * Used for search — authenticated users get trust-graph boosts.
 */
export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      req.user = jwt.verify(
        token!,
        getJwtSecret()
      ) as TokenPayload;
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
