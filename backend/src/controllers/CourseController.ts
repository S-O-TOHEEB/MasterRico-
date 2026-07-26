import { type Request, type Response } from "express";
import { CourseService } from "../services/CourseService.js";
import { CourseStatus } from "../entities/Course.js";
import { UserRole } from "../entities/User.js";
import { param } from "../utils/params.js";

const courseService = new CourseService();

export const CourseController = {
  // POST /courses
  async create(req: Request, res: Response) {
    const course = await courseService.create(req.user!.id, req.body);
    res.status(201).json({ success: true, data: course });
  },

  // GET /courses  (public — published only, always; this route has no auth
  // middleware at all, so there's no user context to check ownership
  // against even if someone wanted to see drafts here — use /courses/my)
  async list(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const { courses, total } = await courseService.list({ page, limit, status: CourseStatus.PUBLISHED });
    res.json({ success: true, data: courses, meta: { total, page, limit } });
  },

  // GET /courses/my  (creator dashboard)
  async listMyCourses(req: Request, res: Response) {
    const courses = await courseService.listByCreator(req.user!.id);
    res.json({ success: true, data: courses });
  },

  // GET /courses/:id — public for published courses; a draft/archived
  // course is only visible to its owning creator or an admin. Returns the
  // same "not found" either way for a non-owner, rather than a 403, so the
  // response doesn't confirm a draft with that id exists at all.
  async getOne(req: Request, res: Response) {
    const course = await courseService.findById(param(req, "id"));
    const isOwnerOrAdmin = req.user && (req.user.id === course.creatorId || req.user.role === UserRole.ADMIN);
    if (course.status !== CourseStatus.PUBLISHED && !isOwnerOrAdmin) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
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
