import { type Request, type Response } from "express";
import { LiveSessionService } from "../services/LiveSessionService.js";
import { param } from "../utils/params.js";

const svc = new LiveSessionService();

export const LiveSessionController = {
  async create(req: Request, res: Response) {
    const session = await svc.create(req.user!.id, req.body);
    res.status(201).json({ success: true, data: session });
  },
  async listUpcoming(req: Request, res: Response) {
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const data  = await svc.listUpcoming(page, limit);
    res.json({ success: true, ...data });
  },
  async listMySessions(req: Request, res: Response) {
    const sessions = await svc.listByCreator(req.user!.id);
    res.json({ success: true, data: sessions });
  },
  async getOne(req: Request, res: Response) {
    const session = await svc.getById(param(req, "id"));
    res.json({ success: true, data: session });
  },
  async update(req: Request, res: Response) {
    const session = await svc.update(param(req, "id"), req.user!.id, req.body);
    res.json({ success: true, data: session });
  },
  async cancel(req: Request, res: Response) {
    const session = await svc.cancel(param(req, "id"), req.user!.id);
    res.json({ success: true, data: session });
  },
  async goLive(req: Request, res: Response) {
    const session = await svc.goLive(param(req, "id"), req.user!.id);
    res.json({ success: true, data: session });
  },
  async getJoinToken(req: Request, res: Response) {
    try {
      const data = await svc.getJoinToken(param(req, "id"), req.user!.id);
      res.json({ success: true, data });
    } catch (e: any) { res.status(400).json({ success: false, message: e.message }); }
  },
  async endSession(req: Request, res: Response) {
    const session = await svc.endSession(param(req, "id"), req.user!.id);
    res.json({ success: true, data: session });
  },
  async rsvp(req: Request, res: Response) {
    const rsvp = await svc.rsvp(param(req, "id"), req.user!.id);
    res.status(201).json({ success: true, data: rsvp });
  },
  async cancelRsvp(req: Request, res: Response) {
    await svc.cancelRsvp(param(req, "id"), req.user!.id);
    res.json({ success: true, message: "RSVP cancelled" });
  },
  async listRsvps(req: Request, res: Response) {
    const rsvps = await svc.listRsvps(param(req, "id"), req.user!.id);
    res.json({ success: true, data: rsvps });
  },
  async myRsvps(req: Request, res: Response) {
    const sessions = await svc.getMyRsvps(req.user!.id);
    res.json({ success: true, data: sessions });
  },
};
