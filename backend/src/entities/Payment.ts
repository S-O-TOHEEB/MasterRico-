import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User.js";

export enum PaymentStatus {
  PENDING   = "pending",
  PAID      = "paid",
  FAILED    = "failed",
  REFUNDED  = "refunded",
  CANCELLED = "cancelled",
}

/** What the payment was actually for — lets one ledger cover every money-moving flow in the app */
export enum PaymentType {
  COURSE_ENROLLMENT    = "course_enrollment",
  SUBSCRIPTION         = "subscription",
  CORPORATE_ACCOUNT    = "corporate_account",
  VERIFIED_CERTIFICATE = "verified_certificate",
  OTHER                = "other",
}

export enum PaymentProvider {
  STRIPE   = "stripe",
  PAYSTACK = "paystack",
}

/**
 * A single, queryable transaction ledger across every payment flow in the
 * app (course purchases, subscriptions, corporate plans, verified
 * certificates). Created (as PENDING) the moment PaymentOrchestrator
 * initiates a payment; moved to PAID/FAILED by WebhookService when the
 * gateway confirms; can be moved to REFUNDED/CANCELLED via
 * PATCH /payments/:id/status or POST /payments/:id/refund.
 *
 * `deletedAt` (soft delete) is a separate axis from `status` on purpose —
 * "an admin removed this record" and "this payment failed" are different
 * facts. A soft-deleted row is excluded from normal queries automatically
 * by TypeORM, but never destroys the audit trail.
 */
@Entity("payments")
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({ type: "enum", enum: PaymentType })
  type!: PaymentType;

  /** The enrollment / subscription / corporate account / certificate id this payment is for */
  @Column({ type: "uuid", nullable: true })
  referenceId?: string;

  @Column({ type: "enum", enum: PaymentProvider })
  provider!: PaymentProvider;

  /** The gateway's own id for this transaction (Stripe PaymentIntent id / Paystack reference) */
  @Column({ type: "varchar", nullable: true })
  providerReference?: string;

  @Column({ type: "integer" })
  amountPence!: number;

  @Column({ type: "varchar", length: 3 })
  currency!: string;

  @Column({ type: "enum", enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Column({ type: "text", nullable: true })
  failureReason?: string;

  /** Free-form context captured at initiation time (courseId, plan, billingPeriod, etc.) */
  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
