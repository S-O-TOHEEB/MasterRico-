import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { PaymentMethodController } from "../controllers/PaymentMethodController.js";
import { authenticate } from "../middlewares/auth.js";

const router = createRouter();
router.use(authenticate);

router.get("/", PaymentMethodController.list);
router.post("/", PaymentMethodController.add);
router.patch("/:id/default", PaymentMethodController.setDefault);
router.delete("/:id", PaymentMethodController.remove);

export default router;
