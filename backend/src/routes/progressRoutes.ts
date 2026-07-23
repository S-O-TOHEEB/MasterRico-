import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { updateProgress, getCourseProgress } from "../controllers/ProgressController.js";
import { authenticate } from "../middlewares/auth.js";

const router = createRouter();

router.post("/", authenticate, updateProgress);
router.get("/:courseId", authenticate, getCourseProgress);

export default router;
