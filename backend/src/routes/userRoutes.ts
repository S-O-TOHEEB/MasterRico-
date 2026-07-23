import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { getUser, listUsers, setUserStatus } from "../controllers/UserController.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { UserRole } from "../entities/User.js";

const router = createRouter();

router.get("/", authenticate, authorize(UserRole.ADMIN), listUsers);
router.get("/:id", getUser);                                                      // public profile
router.patch("/:id/status", authenticate, authorize(UserRole.ADMIN), setUserStatus);

export default router;
