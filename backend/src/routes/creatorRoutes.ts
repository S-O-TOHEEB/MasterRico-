import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { CreatorAnalyticsController } from "../controllers/CreatorAnalyticsController.js";
import { CreatorPayoutController } from "../controllers/CreatorPayoutController.js";
import { authenticate, authorize } from "../middlewares/auth.js";

const router = createRouter();

// All creator routes require auth + creator/admin role
router.use(authenticate, authorize("creator", "admin"));

router.get("/analytics",                     CreatorAnalyticsController.overview);
router.get("/analytics/earnings",            CreatorAnalyticsController.earnings);
router.get("/analytics/students",            CreatorAnalyticsController.students);
router.get("/analytics/courses/:courseId",   CreatorAnalyticsController.courseStats);

// Payout onboarding (real Stripe Connect Express — see CreatorPayoutService)
router.post("/payout/connect",  CreatorPayoutController.connect);
router.post("/payout/callback", CreatorPayoutController.callback);
router.get("/payout/status",    CreatorPayoutController.status);

export default router;
