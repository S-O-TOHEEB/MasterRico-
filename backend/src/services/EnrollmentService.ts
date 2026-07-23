import { AppDataSource } from "../config/database.js";
import { Enrollment, EnrollmentStatus, EnrollmentSource } from "../entities/Enrollment.js";
import { SubscriptionTier } from "../entities/User.js";
import { Course } from "../entities/Course.js";
import { LessonProgress } from "../entities/LessonProgress.js";
import { Lesson } from "../entities/Lesson.js";
import { PaymentOrchestrator } from "./payments/PaymentOrchestrator.js";
import { PaymentType } from "../entities/Payment.js";
import logger from "../utils/logger.js";

export class EnrollmentService {
  private enrollmentRepo = AppDataSource.getRepository(Enrollment);
  private courseRepo = AppDataSource.getRepository(Course);
  private lessonProgressRepo = AppDataSource.getRepository(LessonProgress);
  private lessonRepo = AppDataSource.getRepository(Lesson);
  private paymentOrchestrator = new PaymentOrchestrator();

  /**
   * Enrol a user in a free course (no payment flow).
   */
  async enrollFree(userId: string, courseId: string): Promise<Enrollment> {
    const course = await this.courseRepo.findOneBy({ id: courseId });
    if (!course) throw new Error("Course not found");
    if (course.pricePence > 0) throw new Error("This course is not free");

    const existing = await this.enrollmentRepo.findOneBy({ userId, courseId });
    if (existing) {
      if (existing.status === EnrollmentStatus.ACTIVE) throw new Error("Already enrolled");
      existing.status = EnrollmentStatus.ACTIVE;
      return this.enrollmentRepo.save(existing);
    }

    const enrollment = this.enrollmentRepo.create({
      userId,
      courseId,
      status: EnrollmentStatus.ACTIVE,
      source: EnrollmentSource.FREE,
      amountPaid: 0,
    });
    await this.courseRepo.increment({ id: courseId }, "enrollmentCount", 1);
    return this.enrollmentRepo.save(enrollment);
  }

  /**
   * Initiate a paid enrolment, or enrol free if the learner is on Pro.
   *
   * Learner Pro subscribers → free immediate enrolment (no payment needed).
   * Founding creator courses → 0% commission during the founder window.
   * Standard → payment intent returned, PENDING until webhook confirms.
   */
  async initiatePayment(
    userId: string,
    courseId: string,
    email: string,
    source: EnrollmentSource = EnrollmentSource.PLATFORM
  ) {
    const course = await this.courseRepo.findOneBy({ id: courseId });
    if (!course) throw new Error("Course not found");
    if (course.pricePence === 0) throw new Error("Use enrollFree for free courses");

    const existing = await this.enrollmentRepo.findOneBy({ userId, courseId });
    if (existing?.status === EnrollmentStatus.ACTIVE) throw new Error("Already enrolled");

    // Load learner's subscription tier
    const learner = await AppDataSource.getRepository(
      (await import("../entities/User.js")).User
    ).findOneBy({ id: userId });

    // ── Learner Pro: unlimited course access (no payment required) ───────────
    if (learner?.subscriptionTier === SubscriptionTier.LEARNER_PRO) {
      const enrollment = this.enrollmentRepo.create({
        userId, courseId,
        status:         EnrollmentStatus.ACTIVE,
        source,
        amountPaid:     0,
        commissionRate: 0, // creator paid from subscription revenue pool
      });
      await this.enrollmentRepo.save(enrollment);
      await this.courseRepo.increment({ id: courseId }, "enrollmentCount", 1);
      return { enrollment, paymentIntent: null, proAccess: true };
    }

    // ── Resolve commission rate ───────────────────────────────────────────────
    // Check if course creator is within their founding-creator 0% window
    const creator = await AppDataSource.getRepository(
      (await import("../entities/User.js")).User
    ).findOneBy({ id: course.creatorId });

    let commissionRate: number;
    if (
      creator?.isFoundingCreator &&
      creator.founderCommissionUntil &&
      creator.founderCommissionUntil > new Date()
    ) {
      commissionRate = 0; // Founding creator programme — 0% for first 6 months
    } else {
      commissionRate = source === EnrollmentSource.DIRECT ? 0.10 : 0.20;
    }

    const enrollment = this.enrollmentRepo.create({
      userId, courseId,
      status: EnrollmentStatus.PENDING,
      source,
      amountPaid:   course.pricePence,
      commissionRate,
    });
    const savedEnrollment = await this.enrollmentRepo.save(enrollment);

    const intent = await this.paymentOrchestrator.initializePayment(
      course.pricePence, course.currency, email,
      { type: PaymentType.COURSE_ENROLLMENT, enrollmentId: savedEnrollment.id, courseId, userId }
    );

    savedEnrollment.paymentId = intent.id;
    await this.enrollmentRepo.save(savedEnrollment);

    return { enrollment: savedEnrollment, paymentIntent: intent, proAccess: false };
  }

  /**
   * Called by WebhookService once payment is confirmed.
   */
  async activateEnrollment(enrollmentId: string, paymentId: string): Promise<void> {
    const enrollment = await this.enrollmentRepo.findOneBy({ id: enrollmentId });
    if (!enrollment) {
      logger.warn(`[EnrollmentService] Enrollment ${enrollmentId} not found on webhook`);
      return;
    }

    // Idempotency guard, race-safe: Stripe and Paystack both explicitly
    // document that a webhook event can be delivered more than once. This
    // conditional UPDATE only actually changes a row the first time (WHERE
    // status != ACTIVE), so even two near-simultaneous deliveries for the
    // same enrollment can only pass this once — without it, the increments
    // below would double-count enrollmentCount/totalRevenuePence.
    const result = await this.enrollmentRepo
      .createQueryBuilder()
      .update(Enrollment)
      .set({ status: EnrollmentStatus.ACTIVE, paymentId })
      .where("id = :id", { id: enrollmentId })
      .andWhere("status != :active", { active: EnrollmentStatus.ACTIVE })
      .execute();

    if (!result.affected) {
      logger.info(`[EnrollmentService] Enrollment ${enrollmentId} already active — ignoring duplicate webhook delivery`);
      return;
    }

    // Update course revenue and enrolment count
    await this.courseRepo.increment({ id: enrollment.courseId }, "enrollmentCount", 1);
    await this.courseRepo.increment(
      { id: enrollment.courseId },
      "totalRevenuePence",
      enrollment.amountPaid
    );
  }

  /** Update progress percent from lesson completions */
  async syncProgress(userId: string, courseId: string): Promise<number> {
    const totalLessons = await this.lessonRepo.count({ where: { courseId } });
    if (totalLessons === 0) return 0;

    const completedLessons = await this.lessonProgressRepo.count({
      where: { userId, isCompleted: true, lesson: { courseId } },
      relations: ["lesson"],
    });

    const progress = Math.round((completedLessons / totalLessons) * 100);
    await this.enrollmentRepo.update(
      { userId, courseId },
      {
        progressPercent: progress,
        ...(progress === 100 ? { status: EnrollmentStatus.COMPLETED, completedAt: new Date() } : {}),
      }
    );
    return progress;
  }

  async listByUser(userId: string) {
    return this.enrollmentRepo.find({
      where: { userId, status: EnrollmentStatus.ACTIVE },
      relations: ["course", "course.creator"],
      order: { enrolledAt: "DESC" },
    });
  }

  async hasAccess(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.enrollmentRepo.findOneBy({ userId, courseId });
    return enrollment?.status === EnrollmentStatus.ACTIVE ||
           enrollment?.status === EnrollmentStatus.COMPLETED;
  }

  /**
   * Self-service unenroll — free courses only. A paid enrollment needs an
   * actual refund (see PaymentController.refundPayment), not a silent
   * status flip, since money changed hands and the payments ledger has to
   * stay accurate.
   */
  async unenroll(userId: string, courseId: string): Promise<void> {
    const enrollment = await this.enrollmentRepo.findOneBy({ userId, courseId });
    if (!enrollment) throw new Error("Enrollment not found");
    if (enrollment.amountPaid > 0) {
      throw new Error(
        "This course was purchased — contact support to request a refund rather than unenrolling directly"
      );
    }
    if (enrollment.status !== EnrollmentStatus.ACTIVE) {
      throw new Error("Enrollment is not active");
    }

    enrollment.status = EnrollmentStatus.REFUNDED; // nothing was owed, so this simply frees the seat
    await this.enrollmentRepo.save(enrollment);
    await this.courseRepo.decrement({ id: courseId }, "enrollmentCount", 1);
  }
}
