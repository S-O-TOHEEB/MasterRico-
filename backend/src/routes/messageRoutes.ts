import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { MessageController } from "../controllers/MessageController.js";
import { authenticate } from "../middlewares/auth.js";

const router = createRouter();
router.use(authenticate);

router.get("/conversations", MessageController.listConversations);
router.post("/conversations", MessageController.startConversation);
router.get("/conversations/:conversationId", MessageController.listMessages);
router.post("/conversations/:conversationId", MessageController.sendMessage);
router.patch("/conversations/:conversationId/read", MessageController.markRead);

export default router;
