import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { SectionController } from "../controllers/SectionController.js";
import { authenticate, authorize } from "../middlewares/auth.js";

// Mounted at /courses/:courseId/sections  (mergeParams: true in index.ts)
const router = createRouter({ mergeParams: true });

// Public — anyone can read course structure
router.get("/", SectionController.list);

// Creator / Admin only
router.post(  "/",         authenticate, authorize("creator","admin"), SectionController.create);
router.put(   "/reorder",  authenticate, authorize("creator","admin"), SectionController.reorder);
router.patch( "/:sectionId", authenticate, authorize("creator","admin"), SectionController.update);
router.delete("/:sectionId", authenticate, authorize("creator","admin"), SectionController.remove);

export default router;
