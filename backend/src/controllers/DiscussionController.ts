import { type Request, type Response } from "express";
import { DiscussionService } from "../services/DiscussionService.js";
import { param } from "../utils/params.js";

const discussionService = new DiscussionService();

export const DiscussionController = {
  // GET /courses/:courseId/discussions?lessonId=&page=&limit=
  async list(req: Request, res: Response) {
    const page     = parseInt(req.query.page  as string) || 1;
    const limit    = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const lessonId = req.query.lessonId as string | undefined;
    const data = await discussionService.listByCourse(
      param(req, "courseId"), lessonId, page, limit
    );
    res.json({ success: true, ...data });
  },

  // POST /courses/:courseId/discussions
  async createPost(req: Request, res: Response) {
    const post = await discussionService.createPost(
      param(req, "courseId"), req.user!.id, req.body
    );
    res.status(201).json({ success: true, data: post });
  },

  // GET /courses/:courseId/discussions/:postId
  async getPost(req: Request, res: Response) {
    const data = await discussionService.getPost(param(req, "postId"));
    res.json({ success: true, data });
  },

  // PATCH /discussions/:postId
  async updatePost(req: Request, res: Response) {
    const post = await discussionService.updatePost(
      param(req, "postId"), req.user!.id, req.body
    );
    res.json({ success: true, data: post });
  },

  // DELETE /discussions/:postId
  async deletePost(req: Request, res: Response) {
    await discussionService.deletePost(param(req, "postId"), req.user!.id);
    res.json({ success: true, message: "Post deleted" });
  },

  // POST /discussions/:postId/upvote
  async upvotePost(req: Request, res: Response) {
    const post = await discussionService.upvotePost(param(req, "postId"));
    res.json({ success: true, data: post });
  },

  // POST /discussions/:postId/replies
  async addReply(req: Request, res: Response) {
    const reply = await discussionService.addReply(
      param(req, "postId"), req.user!.id, req.body
    );
    res.status(201).json({ success: true, data: reply });
  },

  // PATCH /discussions/replies/:replyId
  async updateReply(req: Request, res: Response) {
    const { body } = req.body as { body?: string };
    if (!body) {
      res.status(400).json({ success: false, message: "body is required" });
      return;
    }
    const reply = await discussionService.updateReply(
      param(req, "replyId"), req.user!.id, body
    );
    res.json({ success: true, data: reply });
  },

  // DELETE /discussions/replies/:replyId
  async deleteReply(req: Request, res: Response) {
    await discussionService.deleteReply(param(req, "replyId"), req.user!.id);
    res.json({ success: true, message: "Reply deleted" });
  },

  // POST /discussions/:postId/replies/:replyId/accept
  // courseId is resolved from the post inside the service — not needed in params
  async acceptAnswer(req: Request, res: Response) {
    const reply = await discussionService.markAcceptedAnswer(
      param(req, "replyId"),
      req.user!.id
    );
    res.json({ success: true, data: reply });
  },

  // POST /discussions/:postId/pin  (creator / admin only)
  async pinPost(req: Request, res: Response) {
    const post = await discussionService.pinPost(param(req, "postId"));
    res.json({ success: true, data: post });
  },

  // POST /discussions/:postId/report
  async reportPost(req: Request, res: Response) {
    await discussionService.reportPost(param(req, "postId"));
    res.json({ success: true, message: "Post reported and hidden pending review" });
  },

  // POST /discussions/replies/:replyId/report
  async reportReply(req: Request, res: Response) {
    await discussionService.reportReply(param(req, "replyId"));
    res.json({ success: true, message: "Reply reported and hidden pending review" });
  },
};
