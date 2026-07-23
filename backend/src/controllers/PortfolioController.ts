import { type Request, type Response } from "express";
import { PortfolioService } from "../services/PortfolioService.js";
import { param } from "../utils/params.js";

const service = new PortfolioService();

export const PortfolioController = {
  // GET /profile/creators/:id/portfolio  (public)
  async listPublic(req: Request, res: Response) {
    try {
      const data = await service.listByCreator(param(req, "id"));
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // GET /portfolio/my
  async listMine(req: Request, res: Response) {
    try {
      const data = await service.listByCreator(req.user!.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // POST /portfolio
  async create(req: Request, res: Response) {
    try {
      const data = await service.create(req.user!.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // PATCH /portfolio/:id
  async update(req: Request, res: Response) {
    try {
      const data = await service.update(req.user!.id, param(req, "id"), req.body);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // DELETE /portfolio/:id
  async remove(req: Request, res: Response) {
    try {
      await service.remove(req.user!.id, param(req, "id"));
      res.json({ success: true, message: "Portfolio project deleted" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // PUT /portfolio/reorder
  async reorder(req: Request, res: Response) {
    try {
      const data = await service.reorder(req.user!.id, req.body.orderedIds || []);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
};
