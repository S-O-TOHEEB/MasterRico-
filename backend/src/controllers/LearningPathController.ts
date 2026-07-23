import { type Request, type Response } from "express";
import { LearningPathService } from "../services/LearningPathService.js";
import { param } from "../utils/params.js";

const learningPathService = new LearningPathService();

export const LearningPathController = {
  // POST /learning-paths
  async create(req: Request, res: Response) {
    const path = await learningPathService.create(req.user!.id, req.body);
    res.status(201).json({ success: true, data: path });
  },

  // GET /learning-paths  (public — published)
  async list(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const { paths, total } = await learningPathService.list(page, limit);
    res.json({ success: true, data: paths, meta: { total, page, limit } });
  },

  // GET /learning-paths/my
  async listMy(req: Request, res: Response) {
    const paths = await learningPathService.listByCreator(req.user!.id);
    res.json({ success: true, data: paths });
  },

  // GET /learning-paths/:id
  async getOne(req: Request, res: Response) {
    const path = await learningPathService.findById(param(req, "id"));
    res.json({ success: true, data: path });
  },

  // PATCH /learning-paths/:id
  async update(req: Request, res: Response) {
    const path = await learningPathService.update(
      param(req, "id"),
      req.user!.id,
      req.body
    );
    res.json({ success: true, data: path });
  },

  // POST /learning-paths/:id/publish
  async publish(req: Request, res: Response) {
    const path = await learningPathService.publish(param(req, "id"), req.user!.id);
    res.json({ success: true, data: path });
  },

  // DELETE /learning-paths/:id
  async remove(req: Request, res: Response) {
    await learningPathService.delete(param(req, "id"), req.user!.id);
    res.json({ success: true, message: "Learning path deleted" });
  },

  // PUT /learning-paths/:id/reorder  { courseIds: [...] }
  async reorder(req: Request, res: Response) {
    const { courseIds } = req.body as { courseIds?: string[] };
    if (!Array.isArray(courseIds)) {
      res.status(400).json({ success: false, message: "courseIds must be an array" });
      return;
    }
    const path = await learningPathService.reorderCourses(
      param(req, "id"),
      req.user!.id,
      courseIds
    );
    res.json({ success: true, data: path });
  },
};
