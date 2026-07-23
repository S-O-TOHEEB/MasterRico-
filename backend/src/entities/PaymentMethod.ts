import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User.js";

export enum PaymentMethodProvider {
  STRIPE = "stripe",
  PAYSTACK = "paystack",
}

/**
 * A saved, tokenised reference to a payment method — never raw card data.
 * `externalId` is a real gateway reference: a Stripe PaymentMethod id
 * (pm_xxx) or a Paystack reusable authorization_code — both verified
 * server-side in PaymentMethodService before being stored (see
 * verifyAndAttachStripe / verifyPaystack).
 */
@Entity("payment_methods")
export class PaymentMethod {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({ type: "enum", enum: PaymentMethodProvider })
  provider!: PaymentMethodProvider;

  /** Cosmetic only — e.g. "visa", "mastercard" */
  @Column({ type: "varchar", nullable: true })
  brand?: string;

  @Column({ type: "varchar", length: 4, nullable: true })
  last4?: string;

  @Column({ type: "smallint", nullable: true })
  expiryMonth?: number;

  @Column({ type: "smallint", nullable: true })
  expiryYear?: number;

  /** Real gateway reference — Stripe pm_xxx id or Paystack authorization_code */
  @Column({ type: "varchar", nullable: true })
  externalId?: string;

  @Column({ type: "boolean", default: false })
  isDefault!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
