import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { GamificationController } from "../controllers/GamificationController.js";
import { authenticate } from "../middlewares/auth.js";

const router = createRouter();

// Public badge catalogue
router.get("/badges/all", GamificationController.allBadges);

// Auth required
router.get("/streak",  authenticate, GamificationController.getStreak);
router.get("/badges",  authenticate, GamificationController.myBadges);

export default router;
