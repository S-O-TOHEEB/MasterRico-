import { type Request, type Response } from "express";
import { MessageService } from "../services/MessageService.js";
import { param } from "../utils/params.js";

const service = new MessageService();

export const MessageController = {
  // GET /messages/conversations
  async listConversations(req: Request, res: Response) {
    try {
      const data = await service.listConversations(req.user!.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // POST /messages/conversations   { recipientId }
  async startConversation(req: Request, res: Response) {
    try {
      const data = await service.startOrGetConversation(req.user!.id, req.body.recipientId);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // GET /messages/conversations/:conversationId?page=1&limit=50
  async listMessages(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const data = await service.listMessages(req.user!.id, param(req, "conversationId"), page, limit);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // POST /messages/conversations/:conversationId   { body }
  async sendMessage(req: Request, res: Response) {
    try {
      const data = await service.sendMessage(req.user!.id, param(req, "conversationId"), req.body.body);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // PATCH /messages/conversations/:conversationId/read
  async markRead(req: Request, res: Response) {
    try {
      await service.markRead(req.user!.id, param(req, "conversationId"));
      res.json({ success: true, message: "Marked as read" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
};
