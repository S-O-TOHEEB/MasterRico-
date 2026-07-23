import { type Request, type Response } from "express";
import { LessonService } from "../services/LessonService.js";
import { param } from "../utils/params.js";

const lessonService = new LessonService();

export const LessonController = {
  // GET /courses/:courseId/sections/:sectionId/lessons
  async list(req: Request, res: Response) {
    const lessons = await lessonService.listBySection(
      param(req, "courseId"), param(req, "sectionId")
    );
    res.json({ success: true, data: lessons });
  },

  // POST /courses/:courseId/sections/:sectionId/lessons
  async create(req: Request, res: Response) {
    const lesson = await lessonService.create(
      param(req, "courseId"), param(req, "sectionId"), req.user!.id, req.body
    );
    res.status(201).json({ success: true, data: lesson });
  },

  // PATCH /courses/:courseId/sections/:sectionId/lessons/:lessonId
  async update(req: Request, res: Response) {
    const lesson = await lessonService.update(
      param(req, "lessonId"), param(req, "courseId"), req.user!.id, req.body
    );
    res.json({ success: true, data: lesson });
  },

  // DELETE /courses/:courseId/sections/:sectionId/lessons/:lessonId
  async remove(req: Request, res: Response) {
    await lessonService.delete(
      param(req, "lessonId"), param(req, "courseId"), req.user!.id
    );
    res.json({ success: true, message: "Lesson deleted" });
  },

  // PUT /courses/:courseId/sections/:sectionId/lessons/reorder
  async reorder(req: Request, res: Response) {
    const { orderedIds } = req.body as { orderedIds?: string[] };
    if (!Array.isArray(orderedIds)) {
      res.status(400).json({ success: false, message: "orderedIds must be an array" });
      return;
    }
    await lessonService.reorder(
      param(req, "courseId"), param(req, "sectionId"), req.user!.id, orderedIds
    );
    res.json({ success: true, message: "Lessons reordered" });
  },

  // POST /lessons/:lessonId/complete  (learner action)
  async markComplete(req: Request, res: Response) {
    const progress = await lessonService.markComplete(
      param(req, "lessonId"), req.user!.id
    );
    res.json({ success: true, data: progress });
  },

  // GET /lessons/:lessonId/progress  (learner)
  async getProgress(req: Request, res: Response) {
    const progress = await lessonService.getProgress(
      param(req, "lessonId"), req.user!.id
    );
    res.json({ success: true, data: progress ?? { isCompleted: false } });
  },

  // GET /lessons/:lessonId/summary  (AI-generated summary + key takeaways)
  async getSummary(req: Request, res: Response) {
    const summary = await lessonService.getSummary(
      param(req, "lessonId"), req.user!.id
    );
    res.json({ success: true, data: summary });
  },
};
