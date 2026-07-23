import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { LessonController } from "../controllers/LessonController.js";
import { authenticate, authorize } from "../middlewares/auth.js";

// ── Mounted at /courses/:courseId/sections/:sectionId/lessons ────────────────
export const lessonRouter = createRouter({ mergeParams: true });

lessonRouter.get("/", LessonController.list);

lessonRouter.post(  "/",          authenticate, authorize("creator","admin"), LessonController.create);
lessonRouter.put(   "/reorder",   authenticate, authorize("creator","admin"), LessonController.reorder);
lessonRouter.patch( "/:lessonId", authenticate, authorize("creator","admin"), LessonController.update);
lessonRouter.delete("/:lessonId", authenticate, authorize("creator","admin"), LessonController.remove);

// ── Mounted at /lessons  (learner progress actions) ──────────────────────────
export const lessonProgressRouter = createRouter();

lessonProgressRouter.post( "/:lessonId/complete", authenticate, LessonController.markComplete);
lessonProgressRouter.get(  "/:lessonId/progress", authenticate, LessonController.getProgress);
lessonProgressRouter.get(  "/:lessonId/summary",  authenticate, LessonController.getSummary);
