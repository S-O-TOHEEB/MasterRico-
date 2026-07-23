import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { AdminController } from "../controllers/AdminController.js";
import { authenticate, authorize } from "../middlewares/auth.js";

const router = createRouter();

router.use(authenticate, authorize("admin"));

router.get(    "/founders",       AdminController.listFounders);
router.post(   "/founders/:userId", AdminController.grantFounder);
router.delete( "/founders/:userId", AdminController.revokeFounder);

// ── Content moderation queue ─────────────────────────────────────────────
router.get(   "/moderation/reviews",                  AdminController.listFlaggedReviews);
router.post(  "/moderation/reviews/:id/unflag",       AdminController.unflagReview);
router.delete("/moderation/reviews/:id",               AdminController.deleteReview);
router.get(   "/moderation/discussions/posts",         AdminController.listFlaggedPosts);
router.get(   "/moderation/discussions/replies",       AdminController.listFlaggedReplies);
router.post(  "/moderation/discussions/posts/:id/unflag",   AdminController.unflagPost);
router.post(  "/moderation/discussions/replies/:id/unflag", AdminController.unflagReply);
router.delete("/moderation/discussions/posts/:id",     AdminController.deletePost);
router.delete("/moderation/discussions/replies/:id",   AdminController.deleteReply);

export default router;
