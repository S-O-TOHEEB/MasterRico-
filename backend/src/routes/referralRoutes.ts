import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { ReferralController } from "../controllers/ReferralController.js";
import { authenticate } from "../middlewares/auth.js";

const router = createRouter();

router.use(authenticate);

router.get( "/my-code",   ReferralController.getMyCode);
router.get( "/stats",     ReferralController.getStats);
router.post("/apply",     ReferralController.applyCode);

export default router;
