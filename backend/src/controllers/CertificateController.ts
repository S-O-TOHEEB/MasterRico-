import { type Request, type Response } from "express";
import { CertificateService } from "../services/CertificateService.js";
import { param } from "../utils/params.js";

const certService = new CertificateService();

export const CertificateController = {
  // POST /certificates  { courseId }
  async issue(req: Request, res: Response) {
    const { courseId } = req.body as { courseId?: string };
    if (!courseId) {
      res.status(400).json({ success: false, message: "courseId is required" });
      return;
    }
    const certificate = await certService.issue(req.user!.id, courseId);
    res.status(201).json({ success: true, data: certificate });
  },

  // POST /certificates/verified/initiate  { courseId, tier }
  async initiateVerified(req: Request, res: Response) {
    const { courseId, tier } = req.body as {
      courseId?: string;
      tier?: "basic" | "standard" | "premium";
    };
    if (!courseId || !tier) {
      res.status(400).json({ success: false, message: "courseId and tier are required" });
      return;
    }
    const result = await certService.initiateVerifiedPayment(
      req.user!.id, courseId, tier, req.user!.email,
    );
    res.status(201).json({ success: true, data: result });
  },

  // GET /certificates/my
  async listMy(req: Request, res: Response) {
    const certificates = await certService.listByUser(req.user!.id);
    res.json({ success: true, data: certificates });
  },

  // GET /certificates/verify/:code  (public)
  async verify(req: Request, res: Response) {
    const cert = await certService.verify(param(req, "code"));
    if (!cert) {
      res.status(404).json({ success: false, message: "Certificate not found" });
      return;
    }
    res.json({ success: true, data: cert });
  },
};
