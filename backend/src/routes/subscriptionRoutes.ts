import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { SubscriptionController } from "../controllers/SubscriptionController.js";
import { authenticate } from "../middlewares/auth.js";

const router = createRouter();

router.use(authenticate);

router.get("/current", SubscriptionController.getCurrent);
router.post("/", SubscriptionController.initiate);
router.delete("/current", SubscriptionController.cancel);

export default router;
