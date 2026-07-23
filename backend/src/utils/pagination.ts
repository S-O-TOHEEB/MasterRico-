import type { Request } from "express";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parses ?page=&limit= consistently everywhere, so a fix in one controller
 * (clamping limit, rejecting a negative page) doesn't have to be
 * separately remembered in every other one — see PaymentController's
 * myPayments/listPayments, which didn't have this until an audit caught it.
 */
export function parsePagination(req: Request): { page: number; limit: number } {
  const rawPage = parseInt(req.query.page as string, 10);
  const rawLimit = parseInt(req.query.limit as string, 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;

  return { page, limit };
}
