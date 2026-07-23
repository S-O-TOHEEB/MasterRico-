import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { NotificationController } from "../controllers/NotificationController.js";
import { authenticate } from "../middlewares/auth.js";

const router = createRouter();

router.use(authenticate);

router.get( "/",              NotificationController.list);
router.get( "/unread-count",  NotificationController.unreadCount);
router.post("/read-all",      NotificationController.markAllRead);
router.patch("/:id/read",     NotificationController.markRead);

export default router;
