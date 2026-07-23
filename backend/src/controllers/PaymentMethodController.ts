import { type Request, type Response } from "express";
import { PaymentMethodService } from "../services/PaymentMethodService.js";
import { param } from "../utils/params.js";

const service = new PaymentMethodService();

export const PaymentMethodController = {
  // GET /payment-methods
  async list(req: Request, res: Response) {
    try {
      const data = await service.list(req.user!.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // POST /payment-methods
  async add(req: Request, res: Response) {
    try {
      const data = await service.add(req.user!.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // PATCH /payment-methods/:id/default
  async setDefault(req: Request, res: Response) {
    try {
      const data = await service.setDefault(req.user!.id, param(req, "id"));
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // DELETE /payment-methods/:id
  async remove(req: Request, res: Response) {
    try {
      await service.remove(req.user!.id, param(req, "id"));
      res.json({ success: true, message: "Payment method removed" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
};
