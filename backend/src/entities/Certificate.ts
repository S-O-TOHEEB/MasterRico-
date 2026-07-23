import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User.js";
import { Course } from "./Course.js";

@Entity("certificates")
export class Certificate {
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

  /**
   * Public verification code — format: ES-YYYYMMDD-XXXX
   * Shared on LinkedIn; anyone can verify at /api/v1/certificates/verify/:code
   */
  @Column({ type: "varchar", unique: true })
  certificateCode!: string;

  /** URL to the generated PDF certificate */
  @Column({ type: "varchar", nullable: true })
  certificateUrl?: string;

  /**
   * false = basic completion badge (free, auto-issued)
   * true  = EduStream Verified certificate (£15–£49, requires identity check)
   */
  @Column({ type: "boolean", default: false })
  isVerified!: boolean;

  /** Fee paid in pence (0 for basic, 1500–4900 for verified) */
  @Column({ type: "integer", default: 0 })
  feePaid!: number;

  /** Creator's name at time of issue — snapshotted to survive creator account changes */
  @Column({ type: "varchar" })
  courseTitle!: string;

  @Column({ type: "varchar" })
  creatorName!: string;

  @Column({ type: "varchar" })
  learnerName!: string;

  @CreateDateColumn()
  issuedAt!: Date;
}
