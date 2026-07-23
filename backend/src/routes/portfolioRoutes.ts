import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { PortfolioController } from "../controllers/PortfolioController.js";
import { authenticate, authorize } from "../middlewares/auth.js";

const router = createRouter();
router.use(authenticate, authorize("creator", "admin"));

router.get("/my", PortfolioController.listMine);
router.post("/", PortfolioController.create);
router.put("/reorder", PortfolioController.reorder);
router.patch("/:id", PortfolioController.update);
router.delete("/:id", PortfolioController.remove);

export default router;
