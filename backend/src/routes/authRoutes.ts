import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import {
  register, login,
  verifyOtp, resendOtp,
  changePassword,
  requestPasswordReset, confirmPasswordReset,
} from "../controllers/AuthController.js";
import { authenticate } from "../middlewares/auth.js";

const router = createRouter();

router.post("/register", register);
router.post("/login", login);

// Email verification
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

// Password reset (logged out)
router.post("/password-reset/request", requestPasswordReset);
router.post("/password-reset/confirm", confirmPasswordReset);

// Change password (logged in)
router.patch("/password", authenticate, changePassword);

export default router;
