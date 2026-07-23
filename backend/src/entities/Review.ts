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

@Entity("reviews")
@Unique(["userId", "courseId"])
export class Review {
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

  /** 1–5 star rating */
  @Column({ type: "smallint" })
  rating!: number;

  @Column({ type: "text", nullable: true })
  comment?: string;

  /** True only if the reviewer holds an active Enrollment */
  @Column({ type: "boolean", default: false })
  isVerifiedPurchase!: boolean;

  /** Up-votes from other learners ("was this review helpful?") */
  @Column({ type: "integer", default: 0 })
  helpfulCount!: number;

  @Column({ type: "boolean", default: false })
  isFlagged!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
