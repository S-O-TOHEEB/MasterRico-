import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, randomInt } from "crypto";
import { AppDataSource } from "../config/database.js";
import { User, UserRole, SubscriptionTier } from "../entities/User.js";
import { emailService } from "./EmailService.js";
import { getJwtSecret } from "../config/env.js";

const OTP_TTL_MS = 15 * 60 * 1000;          // 15 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;    // 1 minute
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;   // 30 minutes

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);

  async register(userData: Partial<User>) {
    const { email, password, firstName, lastName, role } = userData;

    if (!email || !password || !firstName || !lastName) {
      throw new Error("email, password, firstName and lastName are required");
    }

    const existingUser = await this.userRepository.findOneBy({ email });
    if (existingUser) {
      throw new Error("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: role || UserRole.LEARNER,
      subscriptionTier: SubscriptionTier.FREE,
    });

    await this.userRepository.save(user);

    // Best-effort: registration still succeeds even if OTP issuance/email fails.
    try {
      await this.issueOtp(user);
    } catch {
      // Swallowed on purpose — email verification can be retried via /auth/resend-otp.
    }

    return this.generateToken(user);
  }

  async login(email: string, password: string) {
    const user = await this.userRepository
      .createQueryBuilder("user")
      .addSelect("user.password")
      .where("user.email = :email", { email })
      .getOne();

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error("Invalid credentials");
    }

    return this.generateToken(user);
  }

  // ── Email verification (OTP) ────────────────────────────────────────────

  private async issueOtp(user: User): Promise<string> {
    const otp = randomInt(100000, 999999).toString();
    user.otpCode = otp;
    user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    user.otpLastSentAt = new Date();
    await this.userRepository.save(user);
    await emailService.sendOtpEmail(user.email, otp);
    return otp;
  }

  async verifyOtp(email: string, otp: string) {
    if (!email || !otp) throw new Error("email and otp are required");

    const user = await this.userRepository
      .createQueryBuilder("user")
      .addSelect("user.otpCode")
      .where("user.email = :email", { email })
      .getOne();

    if (!user) throw new Error("User not found");
    if (user.isEmailVerified) return { message: "Email already verified" };
    if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      throw new Error("That code has expired — request a new one");
    }
    if (user.otpCode !== otp) throw new Error("Incorrect code");

    user.isEmailVerified = true;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    await this.userRepository.save(user);

    return { message: "Email verified successfully" };
  }

  async resendOtp(email: string) {
    if (!email) throw new Error("email is required");
    const generic = { message: "If that email exists and isn't verified yet, a new code has been sent." };

    const user = await this.userRepository.findOneBy({ email });
    if (!user) return generic; // Don't reveal whether the email exists
    if (user.isEmailVerified) return { message: "Email already verified" };
    if (user.otpLastSentAt && Date.now() - user.otpLastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      throw new Error("Please wait a minute before requesting another code");
    }

    await this.issueOtp(user);
    return generic;
  }

  // ── Change password (logged-in user) ────────────────────────────────────

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword) {
      throw new Error("currentPassword and newPassword are required");
    }
    if (newPassword.length < 8) {
      throw new Error("newPassword must be at least 8 characters");
    }

    const user = await this.userRepository
      .createQueryBuilder("user")
      .addSelect("user.password")
      .where("user.id = :id", { id: userId })
      .getOne();
    if (!user) throw new Error("User not found");

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      throw new Error("Current password is incorrect");
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await this.userRepository.save(user);

    return { message: "Password updated successfully" };
  }

  // ── Password reset (logged-out user) ────────────────────────────────────

  async requestPasswordReset(email: string) {
    if (!email) throw new Error("email is required");
    const generic = { message: "If that email exists, a password reset link has been sent." };

    const user = await this.userRepository.findOneBy({ email });
    if (!user) return generic; // Don't reveal whether the email exists

    const token = randomBytes(32).toString("hex");
    user.passwordResetToken = token;
    user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await this.userRepository.save(user);
    await emailService.sendPasswordResetEmail(user.email, token);

    // Opt-in only, and off by default — see .env.example. Lets you retrieve the
    // token from an API response while testing, without a real inbox wired up.
    if (process.env.EXPOSE_DEBUG_CODES === "true") {
      return { ...generic, debugToken: token };
    }
    return generic;
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    if (!token || !newPassword) throw new Error("token and newPassword are required");
    if (newPassword.length < 8) throw new Error("newPassword must be at least 8 characters");

    const user = await this.userRepository
      .createQueryBuilder("user")
      .addSelect("user.passwordResetToken")
      .where("user.passwordResetToken = :token", { token })
      .getOne();

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw new Error("Invalid or expired reset token");
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;
    await this.userRepository.save(user);

    return { message: "Password reset successfully — you can now log in with your new password." };
  }

  private generateToken(user: User) {
    const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as NonNullable<
      jwt.SignOptions["expiresIn"]
    >;
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        interests: user.interests ?? [],
      },
      getJwtSecret(),
      { expiresIn }
    );
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
      },
    };
  }
}

