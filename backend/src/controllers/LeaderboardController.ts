import { type Request, type Response } from "express";
import { LeaderboardService, type LeaderboardType, type LeaderboardPeriod } from "../services/LeaderboardService.js";

const svc = new LeaderboardService();

export const LeaderboardController = {
  // GET /leaderboard?type=completions|streaks|badges&period=weekly|monthly|alltime&limit=50
  async get(req: Request, res: Response) {
    const type   = (req.query.type   as LeaderboardType)  || "completions";
    const period = (req.query.period as LeaderboardPeriod) || "alltime";
    const limit  = Math.min(parseInt(req.query.limit as string) || 50, 100);

    if (!["completions","streaks","badges"].includes(type)) {
      res.status(400).json({ success: false, message: "type must be completions | streaks | badges" });
      return;
    }
    if (!["weekly","monthly","alltime"].includes(period)) {
      res.status(400).json({ success: false, message: "period must be weekly | monthly | alltime" });
      return;
    }

    const data = await svc.getLeaderboard(type, period, limit);
    res.json({ success: true, data, meta: { type, period } });
  },
};
