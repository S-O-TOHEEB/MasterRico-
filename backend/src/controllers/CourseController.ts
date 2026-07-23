import { type Request, type Response } from "express";
import { CourseService } from "../services/CourseService.js";
import { param } from "../utils/params.js";

const courseService = new CourseService();

export const CourseController = {
  // POST /courses
  async create(req: Request, res: Response) {
    const course = await courseService.create(req.user!.id, req.body);
    res.status(201).json({ success: true, data: course });
  },

  // GET /courses  (public — published only)
  async list(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const { courses, total } = await courseService.list({ page, limit });
    res.json({ success: true, data: courses, meta: { total, page, limit } });
  },

  // GET /courses/my  (creator dashboard)
  async listMyCourses(req: Request, res: Response) {
    const courses = await courseService.listByCreator(req.user!.id);
    res.json({ success: true, data: courses });
  },

  // GET /courses/:id
  async getOne(req: Request, res: Response) {
    const course = await courseService.findById(param(req, "id"));
    res.json({ success: true, data: course });
  },

  // PATCH /courses/:id
  async update(req: Request, res: Response) {
    const course = await courseService.update(
      param(req, "id"),
      req.user!.id,
      req.body
    );
    res.json({ success: true, data: course });
  },

  // POST /courses/:id/publish
  async publish(req: Request, res: Response) {
    const course = await courseService.publish(param(req, "id"), req.user!.id);
    res.json({ success: true, data: course });
  },

  // POST /courses/:id/archive
  async archive(req: Request, res: Response) {
    const course = await courseService.archive(param(req, "id"), req.user!.id);
    res.json({ success: true, data: course });
  },

  // DELETE /courses/:id
  async remove(req: Request, res: Response) {
    await courseService.delete(param(req, "id"), req.user!.id);
    res.json({ success: true, message: "Course deleted" });
  },
};
