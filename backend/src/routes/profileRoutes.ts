import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { ProfileController } from "../controllers/ProfileController.js";
import { PortfolioController } from "../controllers/PortfolioController.js";
import { authenticate } from "../middlewares/auth.js";

const router = createRouter();

// Public
router.get("/creators/:id", ProfileController.getCreator);
router.get("/creators/:id/portfolio", PortfolioController.listPublic);

// Auth required
router.get("/me", authenticate, ProfileController.getMe);
router.patch("/me", authenticate, ProfileController.updateMe);
router.post("/follow/:userId", authenticate, ProfileController.follow);
router.delete("/follow/:userId", authenticate, ProfileController.unfollow);
router.get("/following", authenticate, ProfileController.listFollowing);
router.get("/followers", authenticate, ProfileController.listFollowers);

export default router;
