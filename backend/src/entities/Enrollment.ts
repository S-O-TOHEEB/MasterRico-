import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { User } from "./User.js";
import { Course } from "./Course.js";

export enum EnrollmentStatus {
  PENDING = "pending",
  ACTIVE = "active",
  COMPLETED = "completed",
  REFUNDED = "refunded",
}

export enum EnrollmentSource {
  DIRECT = "direct",        // creator-referred: 10% commission
  PLATFORM = "platform",    // EduStream discovery: 20% commission
  CORPORATE = "corporate",  // corporate seat license
  FREE = "free",            // free course
}

@Entity("enrollments")
@Unique(["userId", "courseId"])
export class Enrollment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  courseId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @ManyToOne(() => Course)
  @JoinColumn({ name: "courseId" })
  course!: Course;

  @Column({
    type: "enum",
    enum: EnrollmentStatus,
    default: EnrollmentStatus.ACTIVE,
  })
  status!: EnrollmentStatus;

  @Column({
    type: "enum",
    enum: EnrollmentSource,
    default: EnrollmentSource.PLATFORM,
  })
  source!: EnrollmentSource;

  /** Stripe PaymentIntent id or Paystack reference */
  @Column({ type: "varchar", nullable: true })
  paymentId?: string;

  /** Amount the learner paid in pence */
  @Column({ type: "integer", default: 0 })
  amountPaid!: number;

  /** Commission rate applied at time of purchase (0.10 or 0.20) */
  @Column({ type: "decimal", precision: 4, scale: 2, default: 0.20 })
  commissionRate!: number;

  /** Progress 0–100 (denormalised from LessonProgress) */
  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  progressPercent!: number;

  @Column({ type: "timestamp", nullable: true })
  completedAt?: Date;

  @CreateDateColumn()
  enrolledAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
