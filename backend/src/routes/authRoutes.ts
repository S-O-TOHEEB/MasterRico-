import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import {
  register, login,
  verifyOtp, resendOtp,
  changePassword,
  requestPasswordReset, confirmPasswordReset,
} from "../controllers/AuthController.js";
import { authenticate } from "../middlewares/auth.js";
import { loginRateLimiter, otpRateLimiter, authRateLimiter } from "../middlewares/rateLimit.js";

const router = createRouter();

router.post("/register", authRateLimiter, register);
router.post("/login", loginRateLimiter, login);

// Email verification
router.post("/verify-otp", otpRateLimiter, verifyOtp);
router.post("/resend-otp", authRateLimiter, resendOtp);

// Password reset (logged out)
router.post("/password-reset/request", authRateLimiter, requestPasswordReset);
router.post("/password-reset/confirm", otpRateLimiter, confirmPasswordReset);

// Change password (logged in)
router.patch("/password", authenticate, changePassword);

export default router;
