import { type Request, type Response } from "express";
import { EnrollmentService } from "../services/EnrollmentService.js";
import { EnrollmentSource } from "../entities/Enrollment.js";
import { param } from "../utils/params.js";

const enrollmentService = new EnrollmentService();

export const EnrollmentController = {
  // POST /enrollments/free  { courseId }
  async enrollFree(req: Request, res: Response) {
    const { courseId } = req.body as { courseId?: string };
    if (!courseId) {
      res.status(400).json({ success: false, message: "courseId is required" });
      return;
    }
    const enrollment = await enrollmentService.enrollFree(req.user!.id, courseId);
    res.status(201).json({ success: true, data: enrollment });
  },

  // POST /enrollments/pay  { courseId, source? }
  async initiatePayment(req: Request, res: Response) {
    const { courseId, source } = req.body as { courseId?: string; source?: EnrollmentSource };
    if (!courseId) {
      res.status(400).json({ success: false, message: "courseId is required" });
      return;
    }
    const result = await enrollmentService.initiatePayment(
      req.user!.id,
      courseId,
      req.user!.email,
      source ?? EnrollmentSource.PLATFORM
    );
    res.status(201).json({ success: true, data: result });
  },

  // GET /enrollments/my
  async listMy(req: Request, res: Response) {
    const enrollments = await enrollmentService.listByUser(req.user!.id);
    res.json({ success: true, data: enrollments });
  },

  // POST /enrollments/:courseId/progress/sync
  async syncProgress(req: Request, res: Response) {
    const progress = await enrollmentService.syncProgress(
      req.user!.id,
      param(req, "courseId")
    );
    res.json({ success: true, data: { progressPercent: progress } });
  },

  // GET /enrollments/:courseId/access
  async checkAccess(req: Request, res: Response) {
    const hasAccess = await enrollmentService.hasAccess(
      req.user!.id,
      param(req, "courseId")
    );
    res.json({ success: true, data: { hasAccess } });
  },

  // DELETE /enrollments/:courseId  (free courses only — see EnrollmentService.unenroll)
  async unenroll(req: Request, res: Response) {
    await enrollmentService.unenroll(req.user!.id, param(req, "courseId"));
    res.json({ success: true, message: "Unenrolled" });
  },
};
