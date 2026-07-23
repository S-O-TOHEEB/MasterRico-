import { randomBytes } from "crypto";
import { AppDataSource } from "../config/database.js";
import { Certificate } from "../entities/Certificate.js";
import { Enrollment, EnrollmentStatus } from "../entities/Enrollment.js";
import { Course } from "../entities/Course.js";
import { User } from "../entities/User.js";
import { PaymentOrchestrator } from "./payments/PaymentOrchestrator.js";
import { PaymentType } from "../entities/Payment.js";

export class CertificateService {
  private certRepo       = AppDataSource.getRepository(Certificate);
  private enrollmentRepo = AppDataSource.getRepository(Enrollment);
  private courseRepo     = AppDataSource.getRepository(Course);
  private userRepo       = AppDataSource.getRepository(User);
  private payments       = new PaymentOrchestrator();

  static readonly VERIFIED_CERT_PRICES: Record<string, number> = {
    basic:    1500,   // £15
    standard: 2999,   // £29.99
    premium:  4900,   // £49
  };

  /**
   * Issue a basic completion certificate (free, auto-triggered on 100% progress).
   */
  async issue(userId: string, courseId: string): Promise<Certificate> {
    // Check completion
    const enrollment = await this.enrollmentRepo.findOneBy({ userId, courseId });
    if (!enrollment || enrollment.status !== EnrollmentStatus.COMPLETED) {
      throw new Error("Course must be completed before a certificate can be issued");
    }

    // Idempotent: return existing if already issued
    const existing = await this.certRepo.findOneBy({ userId, courseId });
    if (existing) return existing;

    const course = await this.courseRepo.findOne({
      where: { id: courseId },
      relations: ["creator"],
    });
    if (!course) throw new Error("Course not found");

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new Error("User not found");

    const cert = this.certRepo.create({
      userId,
      courseId,
      certificateCode: this.generateCode(),
      isVerified: false,
      feePaid: 0,
      courseTitle: course.title,
      creatorName: `${course.creator.firstName} ${course.creator.lastName}`,
      learnerName: `${user.firstName} ${user.lastName}`,
    });

    return this.certRepo.save(cert);
  }

  /**
   * Initiate a payment for a verified (blockchain-backed) certificate.
   * Stream 5 revenue: £15–£49 per certificate.
   */
  async initiateVerifiedPayment(
    userId: string,
    courseId: string,
    tier: "basic" | "standard" | "premium",
    email: string
  ) {
    // Must have completed the course first
    const enrollment = await this.enrollmentRepo.findOneBy({ userId, courseId });
    if (!enrollment || enrollment.status !== "completed") {
      throw new Error("Course must be completed before requesting a verified certificate");
    }

    const feePence = CertificateService.VERIFIED_CERT_PRICES[tier] ?? 1500;
    const intent   = await this.payments.initializePayment(
      feePence, "GBP", email,
      { userId, courseId, certTier: tier, type: PaymentType.VERIFIED_CERTIFICATE }
    );

    return { paymentIntent: intent, feePence };
  }

  /**
   * Called by WebhookService after verified cert payment succeeds.
   */
  async issueVerified(userId: string, courseId: string, feePaid: number): Promise<Certificate> {
    const cert = await this.issue(userId, courseId);
    cert.isVerified    = true;
    cert.feePaid       = feePaid;
    return AppDataSource.getRepository(Certificate).save(cert);
  }

  /**
   * Verify a certificate by public code — used for LinkedIn sharing / employer check.
   */
  async verify(certificateCode: string): Promise<Certificate | null> {
    return this.certRepo.findOne({
      where: { certificateCode },
      relations: ["user", "course"],
    });
  }

  async listByUser(userId: string): Promise<Certificate[]> {
    return this.certRepo.find({
      where: { userId },
      relations: ["course"],
      order: { issuedAt: "DESC" },
    });
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private generateCode(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = randomBytes(4).toString("hex").toUpperCase();
    return `ES-${date}-${rand}`;
  }
}
