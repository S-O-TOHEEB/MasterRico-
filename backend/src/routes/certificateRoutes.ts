import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { CertificateController } from "../controllers/CertificateController.js";
import { authenticate } from "../middlewares/auth.js";

const router = createRouter();

// Public verification — no auth required
router.get("/verify/:code", CertificateController.verify);

// Auth required
router.get( "/my",                     authenticate, CertificateController.listMy);
router.post("/",                       authenticate, CertificateController.issue);
router.post("/verified/initiate",      authenticate, CertificateController.initiateVerified);

export default router;
