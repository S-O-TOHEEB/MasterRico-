import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum UserRole {
  LEARNER = "learner",
  CREATOR = "creator",
  ADMIN = "admin",
}

export enum SubscriptionTier {
  FREE = "free",
  LEARNER_PRO = "learner_pro",
  CREATOR_PRO = "creator_pro",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", unique: true })
  email!: string;

  @Column({ type: "varchar", select: false })
  password!: string;

  @Column({ type: "varchar" })
  firstName!: string;

  @Column({ type: "varchar" })
  lastName!: string;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.LEARNER,
  })
  role!: UserRole;

  /** Denormalised from subscriptions table — updated by webhook */
  @Column({
    type: "enum",
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscriptionTier!: SubscriptionTier;

  @Column({ type: "text", nullable: true })
  bio?: string;

  @Column({ type: "varchar", nullable: true })
  profilePictureUrl?: string;

  @Column({ type: "varchar", nullable: true })
  websiteUrl?: string;

  @Column({ type: "varchar", nullable: true })
  linkedinUrl?: string;

  /** Learner: preferred topics. Used by recommendations engine. */
  @Column("simple-array", { nullable: true })
  interests?: string[];

  /**
   * Founding creator flag — zero platform commission until founderCommissionUntil.
   * Set by admin via POST /admin/founders/:userId
   */
  @Column({ type: "boolean", default: false })
  isFoundingCreator!: boolean;

  @Column({ type: "timestamp", nullable: true })
  founderCommissionUntil?: Date;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  // ── Email verification (OTP) ────────────────────────────────────────────
  @Column({ type: "boolean", default: false })
  isEmailVerified!: boolean;

  /** 6-digit code, cleared once verified. select:false — never returned by default queries. */
  @Column({ type: "varchar", nullable: true, select: false })
  otpCode?: string;

  @Column({ type: "timestamp", nullable: true })
  otpExpiresAt?: Date;

  /** Used to rate-limit /auth/resend-otp */
  @Column({ type: "timestamp", nullable: true })
  otpLastSentAt?: Date;

  // ── Password reset ───────────────────────────────────────────────────────
  /** select:false — never returned by default queries. */
  @Column({ type: "varchar", nullable: true, select: false })
  passwordResetToken?: string;

  @Column({ type: "timestamp", nullable: true })
  passwordResetExpiresAt?: Date;

  // ── Creator payout (Stripe Connect onboarding — see CreatorPayoutService) ──
  @Column({ type: "boolean", default: false })
  creatorPayoutConnected!: boolean;

  @Column({ type: "varchar", nullable: true })
  creatorPayoutAccountId?: string;

  // ── Stripe customer (as a payer, not a creator payee — see PaymentMethodService) ──
  @Column({ type: "varchar", nullable: true })
  stripeCustomerId?: string;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;
}
