import { type Request, type Response } from "express";
import { StreakBadgeService } from "../services/StreakBadgeService.js";

const service = new StreakBadgeService();

export const GamificationController = {
  // GET /gamification/streak
  async getStreak(req: Request, res: Response) {
    const streak = await service.getStreak(req.user!.id);
    res.json({ success: true, data: streak ?? { currentStreak: 0, longestStreak: 0, totalActiveDays: 0 } });
  },

  // GET /gamification/badges
  async myBadges(req: Request, res: Response) {
    const badges = await service.listUserBadges(req.user!.id);
    res.json({ success: true, data: badges });
  },

  // GET /gamification/badges/all  (public catalogue)
  async allBadges(_req: Request, res: Response) {
    const badges = await service.listAllBadges();
    res.json({ success: true, data: badges });
  },
};
