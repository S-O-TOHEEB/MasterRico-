import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from "typeorm";
import { User } from "./User.js";

export enum BadgeSlug {
  FOUNDER             = "founder",           // awarded to early creator programme members
  FIRST_ENROLLMENT    = "first_enrollment",
  FIRST_COMPLETION    = "first_completion",
  STREAK_7            = "streak_7",
  STREAK_30           = "streak_30",
  COURSES_3           = "courses_3",
  COURSES_10          = "courses_10",
  FIRST_REVIEW        = "first_review",
  FIRST_DISCUSSION    = "first_discussion",
  HELPFUL_ANSWER      = "helpful_answer",   // reply marked accepted answer
  CREATOR_PUBLISHED   = "creator_published",
  CREATOR_10_STUDENTS = "creator_10_students",
  REFERRAL_FIRST      = "referral_first",   // first successful referral
}

/** Badge definitions — seeded at startup */
@Entity("badges")
export class Badge {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", unique: true })
  slug!: BadgeSlug;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "varchar" })
  iconUrl!: string;

  /** Higher = rarer */
  @Column({ type: "smallint", default: 1 })
  tier!: number;
}

/** Junction: which users have earned which badges */
@Entity("user_badges")
export class UserBadge {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({ type: "uuid" })
  badgeId!: string;

  @ManyToOne(() => Badge)
  @JoinColumn({ name: "badgeId" })
  badge!: Badge;

  @CreateDateColumn()
  awardedAt!: Date;
}
