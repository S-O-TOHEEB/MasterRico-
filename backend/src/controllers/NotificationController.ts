import { type Request, type Response } from "express";
import { NotificationService } from "../services/NotificationService.js";
import { param } from "../utils/params.js";

const notifService = new NotificationService();

export const NotificationController = {
  // GET /notifications?page=&limit=
  async list(req: Request, res: Response) {
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const data  = await notifService.listByUser(req.user!.id, page, limit);
    res.json({ success: true, data });
  },

  // GET /notifications/unread-count
  async unreadCount(req: Request, res: Response) {
    const count = await notifService.getUnreadCount(req.user!.id);
    res.json({ success: true, data: { count } });
  },

  // PATCH /notifications/:id/read
  async markRead(req: Request, res: Response) {
    await notifService.markRead(param(req, "id"), req.user!.id);
    res.json({ success: true, message: "Marked as read" });
  },

  // POST /notifications/read-all
  async markAllRead(req: Request, res: Response) {
    await notifService.markAllRead(req.user!.id);
    res.json({ success: true, message: "All notifications marked as read" });
  },
};
