import { type Request, type Response } from "express";
import { CreatorAnalyticsService } from "../services/CreatorAnalyticsService.js";
import { param } from "../utils/params.js";

const analyticsService = new CreatorAnalyticsService();

export const CreatorAnalyticsController = {
  // GET /creator/analytics
  async overview(req: Request, res: Response) {
    const data = await analyticsService.getOverview(req.user!.id);
    res.json({ success: true, data });
  },

  // GET /creator/analytics/courses/:courseId
  async courseStats(req: Request, res: Response) {
    const data = await analyticsService.getCourseStats(
      param(req, "courseId"), req.user!.id
    );
    res.json({ success: true, data });
  },

  // GET /creator/analytics/earnings
  async earnings(req: Request, res: Response) {
    const data = await analyticsService.getEarnings(req.user!.id);
    res.json({ success: true, data });
  },

  // GET /creator/analytics/students?page=1&limit=50
  async students(req: Request, res: Response) {
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const data = await analyticsService.getStudents(req.user!.id, page, limit);
    res.json({ success: true, data });
  },
};
