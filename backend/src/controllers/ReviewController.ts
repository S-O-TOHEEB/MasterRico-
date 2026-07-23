import { type Request, type Response } from "express";
import { ReviewService } from "../services/ReviewService.js";
import { param } from "../utils/params.js";

const reviewService = new ReviewService();

export const ReviewController = {
  // POST /courses/:courseId/reviews  { rating, comment }
  async create(req: Request, res: Response) {
    const { rating, comment } = req.body as { rating?: string | number; comment?: string };
    if (!rating) {
      res.status(400).json({ success: false, message: "rating is required" });
      return;
    }
    const review = await reviewService.create(
      req.user!.id,
      param(req, "courseId"),
      { rating: parseInt(String(rating)), comment }
    );
    res.status(201).json({ success: true, data: review });
  },

  // GET /courses/:courseId/reviews
  async listByCourse(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const result = await reviewService.listByCourse(
      param(req, "courseId"),
      page,
      limit
    );
    res.json({ success: true, data: result });
  },

  // PATCH /reviews/:id
  async update(req: Request, res: Response) {
    const review = await reviewService.update(
      param(req, "id"),
      req.user!.id,
      req.body as { rating?: number; comment?: string }
    );
    res.json({ success: true, data: review });
  },

  // DELETE /reviews/:id
  async remove(req: Request, res: Response) {
    await reviewService.delete(param(req, "id"), req.user!.id);
    res.json({ success: true, message: "Review deleted" });
  },

  // POST /reviews/:id/helpful
  async markHelpful(req: Request, res: Response) {
    const review = await reviewService.markHelpful(param(req, "id"));
    res.json({ success: true, data: review });
  },

  // POST /reviews/:id/report
  async report(req: Request, res: Response) {
    await reviewService.report(param(req, "id"));
    res.json({ success: true, message: "Review reported and hidden pending review" });
  },
};
