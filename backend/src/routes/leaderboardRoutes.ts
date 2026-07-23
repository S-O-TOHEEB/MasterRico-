import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { LeaderboardController } from "../controllers/LeaderboardController.js";

export const leaderboardRouter = createRouter();
// GET /leaderboard?type=completions|streaks|badges&period=weekly|monthly|alltime
leaderboardRouter.get("/", LeaderboardController.get);
