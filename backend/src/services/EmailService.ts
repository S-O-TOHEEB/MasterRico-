import nodemailer, { type Transporter } from "nodemailer";
import logger from "../utils/logger.js";

/**
 * Email delivery via Brevo's SMTP relay.
 * (Brevo dashboard → Settings → SMTP & API → SMTP tab for host/login/key.)
 *
 * Falls back to logging-only if BREVO_SMTP_USER / BREVO_SMTP_PASS aren't set,
 * so local dev and any environment without credentials configured keeps
 * working exactly like before — same graceful-degradation pattern used
 * elsewhere in this codebase (StorageService, PaymentOrchestrator).
 *
 * Note: Brevo requires the FROM_EMAIL address (or its domain) to be a
 * verified sender in your Brevo account — unverified senders will fail to
 * send even with valid SMTP credentials.
 */
export class EmailService {
  private transporter: Transporter | null | undefined;

  private getTransporter(): Transporter | null {
    if (this.transporter !== undefined) return this.transporter;

    const { BREVO_SMTP_USER, BREVO_SMTP_PASS } = process.env;
    if (!BREVO_SMTP_USER || !BREVO_SMTP_PASS) {
      this.transporter = null;
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
      port: Number(process.env.BREVO_SMTP_PORT) || 587,
      secure: process.env.BREVO_SMTP_SECURE === "true", // false (STARTTLS on 587) unless using port 465
      auth: {
        user: BREVO_SMTP_USER,
        pass: BREVO_SMTP_PASS,
      },
      // nodemailer's defaults (2 min connection/socket timeout) are far too
      // long for something awaited inside a request handler — a slow or
      // unreachable SMTP host would hang registration/password-reset for up
      // to 2 minutes per attempt. 10s is generous for SMTP and fails fast.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
    return this.transporter;
  }

  private async send(
    to: string, subject: string, text: string, html?: string
  ): Promise<{ delivered: boolean; stubbed: boolean }> {
    const transporter = this.getTransporter();

    if (!transporter) {
      logger.info(`[EmailService] STUB (BREVO_SMTP_USER/PASS not set) — would send to ${to}: "${subject}" — ${text}`);
      return { delivered: false, stubbed: true };
    }

    const fromEmail = process.env.FROM_EMAIL || "noreply@edustream.io";
    const fromName = process.env.FROM_NAME || "EduStream";

    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        text,
        html: html || `<p>${text}</p>`,
      });
      logger.info(`[EmailService] Sent "${subject}" to ${to} via Brevo`);
      return { delivered: true, stubbed: false };
    } catch (error: any) {
      // Best-effort by design: a failed email must never break the calling
      // flow (registration, password reset, etc.) — log it and move on.
      // Common causes: FROM_EMAIL not verified in Brevo, or a wrong SMTP key.
      logger.error(`[EmailService] Failed to send "${subject}" to ${to}: ${error.message}`);
      return { delivered: false, stubbed: false };
    }
  }

  async sendOtpEmail(to: string, otp: string) {
    return this.send(
      to,
      "Your EduStream verification code",
      `Your verification code is ${otp}. It expires in 15 minutes. If you didn't request this, you can ignore this email.`,
      `<p>Your verification code is <strong style="font-size:20px; letter-spacing:2px;">${otp}</strong>.</p>
       <p>It expires in 15 minutes. If you didn't request this, you can ignore this email.</p>`
    );
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const base = process.env.FRONTEND_URL || "https://app.edustream.io";
    const resetUrl = `${base}/reset-password?token=${token}`;
    return this.send(
      to,
      "Reset your EduStream password",
      `Reset your password using this link: ${resetUrl} (expires in 30 minutes). If you didn't request this, you can ignore this email.`,
      `<p><a href="${resetUrl}">Reset your password</a> (expires in 30 minutes).</p>
       <p>If you didn't request this, you can ignore this email.</p>`
    );
  }
}

export const emailService = new EmailService();
