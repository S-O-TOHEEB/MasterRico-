import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Unique,
} from "typeorm";
import { User } from "./User.js";
import { CorporateAccount } from "./CorporateAccount.js";

export enum CorporateMemberRole {
  ADMIN  = "admin",
  MEMBER = "member",
}

export enum CorporateMemberStatus {
  PENDING  = "pending",   // invite sent, not yet accepted
  ACTIVE   = "active",
  REMOVED  = "removed",
}

@Entity("corporate_members")
@Unique(["accountId", "email"])
export class CorporateMember {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  accountId!: string;

  @ManyToOne(() => CorporateAccount)
  @JoinColumn({ name: "accountId" })
  account!: CorporateAccount;

  /** Null until the invite is accepted and linked to a real user */
  @Column({ type: "uuid", nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "userId" })
  user?: User;

  @Column({ type: "varchar" })
  email!: string;

  @Column({
    type: "enum",
    enum: CorporateMemberRole,
    default: CorporateMemberRole.MEMBER,
  })
  role!: CorporateMemberRole;

  @Column({
    type: "enum",
    enum: CorporateMemberStatus,
    default: CorporateMemberStatus.PENDING,
  })
  status!: CorporateMemberStatus;

  /** Token emailed to the invitee — cleared on acceptance */
  @Column({ type: "varchar", nullable: true })
  inviteToken?: string;

  @Column({ type: "timestamp", nullable: true })
  inviteExpiresAt?: Date;

  @CreateDateColumn()
  invitedAt!: Date;
}
