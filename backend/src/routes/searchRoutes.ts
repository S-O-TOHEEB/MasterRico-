import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { SearchController } from "../controllers/SearchController.js";
import { authenticate, optionalAuthenticate } from "../middlewares/auth.js";

const router = createRouter();

// Public with optional auth (trust graph boost for logged-in users)
router.get("/", optionalAuthenticate, SearchController.search);
router.get("/trending", SearchController.trending);

// Authenticated — personalised recommendations
router.get("/recommendations", authenticate, SearchController.recommendations);

export default router;
