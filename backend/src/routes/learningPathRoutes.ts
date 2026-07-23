import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { LearningPathController } from "../controllers/LearningPathController.js";
import { authenticate, authorize } from "../middlewares/auth.js";

const router = createRouter();

// ── Public ────────────────────────────────────────────────────────────────────
router.get("/", LearningPathController.list);

// ── Static named segments MUST come before /:id ───────────────────────────────
router.get("/my/paths", authenticate, LearningPathController.listMy);

// ── Dynamic segment ───────────────────────────────────────────────────────────
router.get("/:id", LearningPathController.getOne);

// ── Creator / Admin ───────────────────────────────────────────────────────────
router.post(
  "/",
  authenticate,
  authorize("creator", "admin"),
  LearningPathController.create
);
router.patch(
  "/:id",
  authenticate,
  authorize("creator", "admin"),
  LearningPathController.update
);
router.post(
  "/:id/publish",
  authenticate,
  authorize("creator", "admin"),
  LearningPathController.publish
);
router.put(
  "/:id/reorder",
  authenticate,
  authorize("creator", "admin"),
  LearningPathController.reorder
);
router.delete(
  "/:id",
  authenticate,
  authorize("creator", "admin"),
  LearningPathController.remove
);

export default router;
