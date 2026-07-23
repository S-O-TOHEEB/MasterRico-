import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { CourseController } from "../controllers/CourseController.js";
import { authenticate, authorize } from "../middlewares/auth.js";

const router = createRouter();

// ── Public ────────────────────────────────────────────────────────────────────
router.get("/", CourseController.list);

// ── Static named segments MUST come before /:id ───────────────────────────────
router.get("/my/courses", authenticate, CourseController.listMyCourses);

// ── Dynamic segment ───────────────────────────────────────────────────────────
router.get("/:id", CourseController.getOne);

// ── Creator / Admin ───────────────────────────────────────────────────────────
router.post(
  "/",
  authenticate,
  authorize("creator", "admin"),
  CourseController.create
);
router.patch(
  "/:id",
  authenticate,
  authorize("creator", "admin"),
  CourseController.update
);
router.post(
  "/:id/publish",
  authenticate,
  authorize("creator", "admin"),
  CourseController.publish
);
router.post(
  "/:id/archive",
  authenticate,
  authorize("creator", "admin"),
  CourseController.archive
);
router.delete(
  "/:id",
  authenticate,
  authorize("creator", "admin"),
  CourseController.remove
);

export default router;
