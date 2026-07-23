import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { DiscussionController } from "../controllers/DiscussionController.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { reportRateLimiter } from "../middlewares/rateLimit.js";

// ── Mounted at /courses/:courseId/discussions ─────────────────────────────────
export const courseDiscussionRouter = createRouter({ mergeParams: true });

courseDiscussionRouter.get( "/",         authenticate, DiscussionController.list);
courseDiscussionRouter.post("/",         authenticate, DiscussionController.createPost);
courseDiscussionRouter.get( "/:postId",  authenticate, DiscussionController.getPost);

// ── Mounted at /discussions  (post-level and reply actions) ──────────────────
export const discussionRouter = createRouter();

discussionRouter.patch( "/:postId",               authenticate, DiscussionController.updatePost);
discussionRouter.delete("/:postId",               authenticate, DiscussionController.deletePost);
discussionRouter.post(  "/:postId/upvote",        authenticate, DiscussionController.upvotePost);
discussionRouter.post(  "/:postId/pin",           authenticate, authorize("creator","admin"), DiscussionController.pinPost);
discussionRouter.post(  "/:postId/replies",       authenticate, DiscussionController.addReply);
discussionRouter.patch( "/replies/:replyId",      authenticate, DiscussionController.updateReply);
discussionRouter.delete("/replies/:replyId",      authenticate, DiscussionController.deleteReply);
discussionRouter.post(
  "/:postId/replies/:replyId/accept",
  authenticate,
  DiscussionController.acceptAnswer
);
discussionRouter.post("/:postId/report",          authenticate, reportRateLimiter, DiscussionController.reportPost);
discussionRouter.post("/replies/:replyId/report", authenticate, reportRateLimiter, DiscussionController.reportReply);
