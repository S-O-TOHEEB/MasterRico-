import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User.js";

export enum SubscriptionPlan {
  CREATOR_PRO = "creator_pro",  // £29/month — unlimited uploads, analytics, CRM
  LEARNER_PRO = "learner_pro",  // £9.99/month or £79.99/year
}

export enum SubscriptionStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  PAST_DUE = "past_due",
  TRIALING = "trialing",
}

export enum BillingPeriod {
  MONTHLY = "monthly",
  ANNUAL = "annual",
}

@Entity("subscriptions")
export class Subscription {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({ type: "enum", enum: SubscriptionPlan })
  plan!: SubscriptionPlan;

  @Column({
    type: "enum",
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @Column({
    type: "enum",
    enum: BillingPeriod,
    default: BillingPeriod.MONTHLY,
  })
  billingPeriod!: BillingPeriod;

  /** Gateway-specific identifiers */
  @Column({ type: "varchar", nullable: true })
  stripeSubscriptionId?: string;

  @Column({ type: "varchar", nullable: true })
  stripeCustomerId?: string;

  @Column({ type: "varchar", nullable: true })
  paystackSubscriptionCode?: string;

  @Column({ type: "varchar", nullable: true })
  paystackCustomerCode?: string;

  /** Recurring charge in pence (999 monthly / 7999 annual for learner; 2900 for creator) */
  @Column({ type: "integer" })
  amountPence!: number;

  @Column({ type: "varchar", length: 3, default: "GBP" })
  currency!: string;

  @Column({ type: "timestamp" })
  currentPeriodEnd!: Date;

  @Column({ type: "boolean", default: false })
  cancelAtPeriodEnd!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
