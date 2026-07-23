import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { ReviewController } from "../controllers/ReviewController.js";
import { authenticate } from "../middlewares/auth.js";
import { reportRateLimiter } from "../middlewares/rateLimit.js";

// ── Mounted at /courses/:courseId/reviews ────────────────────────────────────
export const courseReviewRouter = createRouter({ mergeParams: true });

courseReviewRouter.get("/", ReviewController.listByCourse);
courseReviewRouter.post("/", authenticate, ReviewController.create);

// ── Mounted at /reviews ───────────────────────────────────────────────────────
export const reviewRouter = createRouter();

reviewRouter.patch("/:id", authenticate, ReviewController.update);
reviewRouter.delete("/:id", authenticate, ReviewController.remove);
reviewRouter.post("/:id/helpful", ReviewController.markHelpful);
reviewRouter.post("/:id/report", authenticate, reportRateLimiter, ReviewController.report);
