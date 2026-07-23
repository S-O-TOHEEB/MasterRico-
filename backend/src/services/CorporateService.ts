import { randomBytes } from "crypto";
import { AppDataSource } from "../config/database.js";
import {
  CorporateAccount, CorporatePlan, CorporateStatus,
  CORPORATE_SEAT_LIMITS, CORPORATE_PLAN_PRICES_PENCE,
} from "../entities/CorporateAccount.js";
import {
  CorporateMember, CorporateMemberRole, CorporateMemberStatus,
} from "../entities/CorporateMember.js";
import { Enrollment, EnrollmentSource, EnrollmentStatus } from "../entities/Enrollment.js";
import { User } from "../entities/User.js";
import { Course } from "../entities/Course.js";
import { PaymentOrchestrator } from "./payments/PaymentOrchestrator.js";
import { PaymentType } from "../entities/Payment.js";
import logger from "../utils/logger.js";

export class CorporateService {
  private accountRepo    = AppDataSource.getRepository(CorporateAccount);
  private memberRepo     = AppDataSource.getRepository(CorporateMember);
  private enrollmentRepo = AppDataSource.getRepository(Enrollment);
  private userRepo       = AppDataSource.getRepository(User);
  private courseRepo     = AppDataSource.getRepository(Course);
  private payments       = new PaymentOrchestrator();

  // ── Account lifecycle ────────────────────────────────────────────────────────

  async initiatePurchase(
    adminUserId: string,
    plan: CorporatePlan,
    companyName: string,
    email: string,
    currency = "GBP",
    customSeats?: number,
  ) {
    const maxSeats      = customSeats ?? CORPORATE_SEAT_LIMITS[plan];
    const annualFee     = CORPORATE_PLAN_PRICES_PENCE[plan];
    const licenceExpiry = new Date();
    licenceExpiry.setFullYear(licenceExpiry.getFullYear() + 1);

    const account = this.accountRepo.create({
      adminUserId,
      companyName,
      plan,
      status:           CorporateStatus.PENDING,
      maxSeats,
      usedSeats:        0,
      annualFeePence:   annualFee,
      currency,
      licenceExpiresAt: licenceExpiry,
    });
    const saved = await this.accountRepo.save(account);

    const intent = await this.payments.initializePayment(
      annualFee, currency, email,
      { type: PaymentType.CORPORATE_ACCOUNT, corporateAccountId: saved.id, adminUserId, plan },
    );

    return { account: saved, paymentIntent: intent };
  }

  async getAccountForAdmin(adminUserId: string): Promise<CorporateAccount> {
    const account = await this.accountRepo.findOne({
      where: { adminUserId, status: CorporateStatus.ACTIVE },
    });
    if (!account) throw new Error("No active corporate account found");
    return account;
  }

  async activateAccount(accountId: string): Promise<void> {
    await this.accountRepo.update(accountId, { status: CorporateStatus.ACTIVE });
    logger.info(`[CorporateService] Account ${accountId} activated`);
  }

  // ── Seat / member management ─────────────────────────────────────────────────

  async inviteMember(
    accountId: string, adminUserId: string, email: string,
    role: CorporateMemberRole = CorporateMemberRole.MEMBER,
  ): Promise<CorporateMember> {
    await this.assertAdmin(accountId, adminUserId);

    const existing = await this.memberRepo.findOneBy({ accountId, email });
    if (existing && existing.status !== CorporateMemberStatus.REMOVED) {
      throw new Error("This email is already a member or has a pending invite");
    }

    // Atomic, race-safe seat check: the increment only applies if the WHERE
    // clause still holds when the DB executes it, so two concurrent invites
    // can't both squeeze through when only one seat is left (the previous
    // read-then-write version could, since two requests could both read
    // usedSeats < maxSeats before either had incremented it).
    const seatResult = await this.accountRepo
      .createQueryBuilder()
      .update(CorporateAccount)
      .set({ usedSeats: () => '"usedSeats" + 1' })
      .where("id = :id", { id: accountId })
      .andWhere('"usedSeats" < "maxSeats"')
      .execute();
    if (!seatResult.affected) {
      throw new Error("Seat limit reached. Upgrade your plan.");
    }

    const inviteExpiry = new Date();
    inviteExpiry.setDate(inviteExpiry.getDate() + 7); // 7-day invite window

    const member = this.memberRepo.create({
      accountId,
      email,
      role,
      status:          CorporateMemberStatus.PENDING,
      inviteToken:     randomBytes(24).toString("hex"),
      inviteExpiresAt: inviteExpiry,
    });

    try {
      return await this.memberRepo.save(member);
    } catch (err) {
      // Roll back the seat we just reserved if creating the member row fails,
      // so a DB hiccup here doesn't permanently burn a seat for nothing.
      await this.accountRepo.decrement({ id: accountId }, "usedSeats", 1);
      throw err;
    }
  }

  async acceptInvite(token: string, userId: string): Promise<CorporateMember> {
    const member = await this.memberRepo.findOneBy({ inviteToken: token });
    if (!member) throw new Error("Invalid or expired invite token");
    if (member.inviteExpiresAt && member.inviteExpiresAt < new Date()) {
      throw new Error("Invite has expired");
    }

    member.userId        = userId;
    member.status        = CorporateMemberStatus.ACTIVE;
    member.inviteToken   = undefined;
    return this.memberRepo.save(member);
  }

  async removeMember(
    accountId: string, adminUserId: string, memberId: string,
  ): Promise<void> {
    await this.assertAdmin(accountId, adminUserId);
    const member = await this.memberRepo.findOneBy({ id: memberId, accountId });
    if (!member) throw new Error("Member not found");

    member.status = CorporateMemberStatus.REMOVED;
    await this.memberRepo.save(member);
    await this.accountRepo.decrement({ id: accountId }, "usedSeats", 1);
  }

  async listMembers(accountId: string, adminUserId: string) {
    await this.assertAdmin(accountId, adminUserId);
    return this.memberRepo.find({
      where: { accountId },
      relations: ["user"],
      order: { invitedAt: "DESC" },
    });
  }

  // ── Team enrollment ──────────────────────────────────────────────────────────

  /**
   * Bulk-enrol all active team members in a course.
   * Corporate accounts pay a flat licence fee, not per-enrollment —
   * so amountPaid = 0 and commissionRate = 0.
   */
  async enrollTeam(
    accountId: string, adminUserId: string, courseId: string,
  ): Promise<{ enrolled: number; skipped: number }> {
    await this.assertAdmin(accountId, adminUserId);

    const course = await this.courseRepo.findOneBy({ id: courseId });
    if (!course) throw new Error("Course not found");

    const activeMembers = await this.memberRepo.find({
      where: { accountId, status: CorporateMemberStatus.ACTIVE },
    });

    let enrolled = 0, skipped = 0;
    for (const member of activeMembers) {
      if (!member.userId) { skipped++; continue; }

      const exists = await this.enrollmentRepo.findOneBy({
        userId: member.userId, courseId,
      });
      if (exists) { skipped++; continue; }

      await this.enrollmentRepo.save(
        this.enrollmentRepo.create({
          userId:         member.userId,
          courseId,
          status:         EnrollmentStatus.ACTIVE,
          source:         EnrollmentSource.CORPORATE,
          amountPaid:     0,
          commissionRate: 0,
        }),
      );
      enrolled++;
    }

    if (enrolled > 0) {
      await this.courseRepo.increment({ id: courseId }, "enrollmentCount", enrolled);
    }

    return { enrolled, skipped };
  }

  // ── Corporate analytics ──────────────────────────────────────────────────────

  async getTeamProgress(accountId: string, adminUserId: string) {
    await this.assertAdmin(accountId, adminUserId);

    const members = await this.memberRepo.find({
      where: { accountId, status: CorporateMemberStatus.ACTIVE },
      relations: ["user"],
    });

    const memberUserIds = members.map(m => m.userId).filter(Boolean) as string[];
    if (memberUserIds.length === 0) {
      return { members: [], totalEnrollments: 0, completionRate: 0 };
    }

    const enrollments = await this.enrollmentRepo
      .createQueryBuilder("e")
      .leftJoinAndSelect("e.course", "course")
      .where("e.userId IN (:...ids)", { ids: memberUserIds })
      .getMany();

    const completed  = enrollments.filter(e => e.status === EnrollmentStatus.COMPLETED);
    const completion = enrollments.length > 0
      ? Math.round((completed.length / enrollments.length) * 100)
      : 0;

    const progressByUser = memberUserIds.map(uid => {
      const userEnrollments = enrollments.filter(e => e.userId === uid);
      const member          = members.find(m => m.userId === uid);
      return {
        userId:      uid,
        name:        member?.user ? `${member.user.firstName} ${member.user.lastName}` : "Pending",
        email:       member?.email ?? "",
        enrollments: userEnrollments.length,
        completed:   userEnrollments.filter(e => e.status === EnrollmentStatus.COMPLETED).length,
        avgProgress: userEnrollments.length > 0
          ? Math.round(userEnrollments.reduce((s, e) => s + Number(e.progressPercent), 0) / userEnrollments.length)
          : 0,
      };
    });

    return {
      members:          progressByUser,
      totalEnrollments: enrollments.length,
      completionRate:   completion,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async assertAdmin(
    accountId: string, userId: string,
  ): Promise<CorporateAccount> {
    const account = await this.accountRepo.findOneBy({ id: accountId });
    if (!account) throw new Error("Corporate account not found");
    if (account.adminUserId !== userId) throw new Error("Access denied");
    if (account.status !== CorporateStatus.ACTIVE) throw new Error("Account is not active");
    return account;
  }
}
