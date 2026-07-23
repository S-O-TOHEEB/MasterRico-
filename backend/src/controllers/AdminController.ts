import { type Request, type Response } from "express";
import { AdminService } from "../services/AdminService.js";
import { param } from "../utils/params.js";
import { parsePagination } from "../utils/pagination.js";

const adminService = new AdminService();

export const AdminController = {
  // GET /admin/founders
  async listFounders(req: Request, res: Response) {
    const users = await adminService.listFoundingCreators();
    res.json({ success: true, data: users });
  },

  // POST /admin/founders/:userId
  async grantFounder(req: Request, res: Response) {
    const user = await adminService.grantFounderStatus(param(req, "userId"));
    res.json({ success: true, data: user, message: "Founder status granted — 0% commission for 6 months, Founder badge awarded" });
  },

  // DELETE /admin/founders/:userId
  async revokeFounder(req: Request, res: Response) {
    const user = await adminService.revokeFounderStatus(param(req, "userId"));
    res.json({ success: true, data: user, message: "Founder status revoked" });
  },

  // ── Content moderation queue ─────────────────────────────────────────────

  // GET /admin/moderation/reviews?page=&limit=
  async listFlaggedReviews(req: Request, res: Response) {
    const { page, limit } = parsePagination(req);
    const data  = await adminService.listFlaggedReviews(page, limit);
    res.json({ success: true, data });
  },

  // POST /admin/moderation/reviews/:id/unflag
  async unflagReview(req: Request, res: Response) {
    const review = await adminService.unflagReview(param(req, "id"));
    res.json({ success: true, data: review });
  },

  // DELETE /admin/moderation/reviews/:id
  async deleteReview(req: Request, res: Response) {
    await adminService.deleteReview(param(req, "id"));
    res.json({ success: true, message: "Review deleted" });
  },

  // GET /admin/moderation/discussions/posts?page=&limit=
  async listFlaggedPosts(req: Request, res: Response) {
    const { page, limit } = parsePagination(req);
    const data  = await adminService.listFlaggedDiscussionPosts(page, limit);
    res.json({ success: true, data });
  },

  // GET /admin/moderation/discussions/replies?page=&limit=
  async listFlaggedReplies(req: Request, res: Response) {
    const { page, limit } = parsePagination(req);
    const data  = await adminService.listFlaggedDiscussionReplies(page, limit);
    res.json({ success: true, data });
  },

  // POST /admin/moderation/discussions/posts/:id/unflag
  async unflagPost(req: Request, res: Response) {
    const post = await adminService.unflagDiscussionPost(param(req, "id"));
    res.json({ success: true, data: post });
  },

  // POST /admin/moderation/discussions/replies/:id/unflag
  async unflagReply(req: Request, res: Response) {
    const reply = await adminService.unflagDiscussionReply(param(req, "id"));
    res.json({ success: true, data: reply });
  },

  // DELETE /admin/moderation/discussions/posts/:id
  async deletePost(req: Request, res: Response) {
    await adminService.deleteDiscussionPost(param(req, "id"));
    res.json({ success: true, message: "Post deleted" });
  },

  // DELETE /admin/moderation/discussions/replies/:id
  async deleteReply(req: Request, res: Response) {
    await adminService.deleteDiscussionReply(param(req, "id"));
    res.json({ success: true, message: "Reply deleted" });
  },
};
