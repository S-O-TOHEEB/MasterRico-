import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { EnrollmentController } from "../controllers/EnrollmentController.js";
import { authenticate } from "../middlewares/auth.js";

const router = createRouter();

// All enrollment routes require authentication
router.use(authenticate);

router.get("/my", EnrollmentController.listMy);
router.post("/free", EnrollmentController.enrollFree);
router.post("/pay", EnrollmentController.initiatePayment);
router.post("/:courseId/progress/sync", EnrollmentController.syncProgress);
router.get("/:courseId/access", EnrollmentController.checkAccess);
router.delete("/:courseId", EnrollmentController.unenroll);

export default router;
