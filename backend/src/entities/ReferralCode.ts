import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from "typeorm";
import { User } from "./User.js";

export enum ReferralRewardType {
  FREE_PRO_MONTH  = "free_pro_month",
  CREDIT_PENCE    = "credit_pence",
}

export enum ReferralStatus {
  PENDING   = "pending",    // code used but referred user hasn't paid yet
  CONVERTED = "converted",  // referred user made a qualifying purchase
  REWARDED  = "rewarded",   // referrer reward has been applied
}

@Entity("referral_codes")
export class ReferralCode {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** The user who owns this referral code */
  @Column({ type: "uuid" })
  ownerId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "ownerId" })
  owner!: User;

  /** Short code shown to users — e.g. JANE2024 */
  @Column({ type: "varchar", unique: true })
  code!: string;

  /** How many times this code has been successfully converted */
  @Column({ type: "integer", default: 0 })
  totalConversions!: number;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}

/** One record per referral conversion event */
@Entity("referral_conversions")
export class ReferralConversion {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  referralCodeId!: string;

  @ManyToOne(() => ReferralCode)
  @JoinColumn({ name: "referralCodeId" })
  referralCode!: ReferralCode;

  /** The user who signed up using the code */
  @Column({ type: "uuid" })
  referredUserId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "referredUserId" })
  referredUser!: User;

  @Column({
    type: "enum",
    enum: ReferralStatus,
    default: ReferralStatus.PENDING,
  })
  status!: ReferralStatus;

  @Column({
    type: "enum",
    enum: ReferralRewardType,
    default: ReferralRewardType.FREE_PRO_MONTH,
  })
  rewardType!: ReferralRewardType;

  /** Pence value if rewardType = CREDIT_PENCE */
  @Column({ type: "integer", default: 0 })
  rewardAmountPence!: number;

  @Column({ type: "boolean", default: false })
  rewardApplied!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
