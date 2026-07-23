import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { followUser, unfollowUser, getFollowing, getFollowers } from "../controllers/TrustController.js";
import { authenticate } from "../middlewares/auth.js";

const router = createRouter();

router.get("/following", authenticate, getFollowing);
router.get("/followers", authenticate, getFollowers);
router.post("/follow/:userId", authenticate, followUser);
router.delete("/follow/:userId", authenticate, unfollowUser);

export default router;
