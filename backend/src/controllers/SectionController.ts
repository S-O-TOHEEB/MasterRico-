import { type Request, type Response } from "express";
import { SectionService } from "../services/SectionService.js";
import { param } from "../utils/params.js";

const sectionService = new SectionService();

export const SectionController = {
  // GET /courses/:courseId/sections
  async list(req: Request, res: Response) {
    const sections = await sectionService.listByCourse(param(req, "courseId"));
    res.json({ success: true, data: sections });
  },

  // POST /courses/:courseId/sections
  async create(req: Request, res: Response) {
    const section = await sectionService.create(
      param(req, "courseId"), req.user!.id, req.body
    );
    res.status(201).json({ success: true, data: section });
  },

  // PATCH /courses/:courseId/sections/:sectionId
  async update(req: Request, res: Response) {
    const section = await sectionService.update(
      param(req, "sectionId"), param(req, "courseId"), req.user!.id, req.body
    );
    res.json({ success: true, data: section });
  },

  // DELETE /courses/:courseId/sections/:sectionId
  async remove(req: Request, res: Response) {
    await sectionService.delete(
      param(req, "sectionId"), param(req, "courseId"), req.user!.id
    );
    res.json({ success: true, message: "Section deleted" });
  },

  // PUT /courses/:courseId/sections/reorder  { orderedIds: [...] }
  async reorder(req: Request, res: Response) {
    const { orderedIds } = req.body as { orderedIds?: string[] };
    if (!Array.isArray(orderedIds)) {
      res.status(400).json({ success: false, message: "orderedIds must be an array" });
      return;
    }
    await sectionService.reorder(param(req, "courseId"), req.user!.id, orderedIds);
    res.json({ success: true, message: "Sections reordered" });
  },
};
