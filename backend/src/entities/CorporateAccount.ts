import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from "typeorm";
import { User } from "./User.js";

export enum CorporatePlan {
  STARTER    = "starter",    // £5,000/year — 20 seats
  BUSINESS   = "business",   // £12,000/year — 100 seats
  ENTERPRISE = "enterprise", // £20,000+/year — unlimited seats
}

export enum CorporateStatus {
  PENDING   = "pending",   // created, awaiting payment confirmation via webhook
  ACTIVE    = "active",
  SUSPENDED = "suspended",
  EXPIRED   = "expired",
}

export const CORPORATE_SEAT_LIMITS: Record<CorporatePlan, number> = {
  [CorporatePlan.STARTER]:    20,
  [CorporatePlan.BUSINESS]:   100,
  [CorporatePlan.ENTERPRISE]: 999999, // effectively unlimited
};

export const CORPORATE_PLAN_PRICES_PENCE: Record<CorporatePlan, number> = {
  [CorporatePlan.STARTER]:    500_000,   // £5,000
  [CorporatePlan.BUSINESS]:   1_200_000, // £12,000
  [CorporatePlan.ENTERPRISE]: 2_000_000, // £20,000 base
};

@Entity("corporate_accounts")
export class CorporateAccount {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  companyName!: string;

  /** The user who manages the account (billing admin) */
  @Column({ type: "uuid" })
  adminUserId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "adminUserId" })
  admin!: User;

  @Column({ type: "enum", enum: CorporatePlan })
  plan!: CorporatePlan;

  @Column({ type: "enum", enum: CorporateStatus, default: CorporateStatus.PENDING })
  status!: CorporateStatus;

  /** Actual seat count (Enterprise can be negotiated higher than base) */
  @Column({ type: "integer" })
  maxSeats!: number;

  @Column({ type: "integer", default: 0 })
  usedSeats!: number;

  @Column({ type: "integer" })
  annualFeePence!: number;

  @Column({ type: "varchar", length: 3, default: "GBP" })
  currency!: string;

  @Column({ type: "varchar", nullable: true })
  stripeSubscriptionId?: string;

  @Column({ type: "varchar", nullable: true })
  paystackSubscriptionCode?: string;

  @Column({ type: "timestamp" })
  licenceExpiresAt!: Date;

  /** Optional: restrict the account to specific learning paths */
  @Column("simple-array", { nullable: true })
  allowedLearningPathIds?: string[];

  @Column({ type: "varchar", nullable: true })
  logoUrl?: string;

  @Column({ type: "varchar", nullable: true })
  customCertificateBranding?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
