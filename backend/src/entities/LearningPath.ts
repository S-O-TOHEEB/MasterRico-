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

export enum LearningPathStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
}

@Entity("learning_paths")
export class LearningPath {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** Can be created by creators or platform admins */
  @Column({ type: "uuid" })
  creatorId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "creatorId" })
  creator!: User;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "varchar", nullable: true })
  thumbnailUrl?: string;

  /** Outcome of completing the full path */
  @Column({ type: "text", nullable: true })
  outcome?: string;

  @Column({
    type: "enum",
    enum: LearningPathStatus,
    default: LearningPathStatus.DRAFT,
  })
  status!: LearningPathStatus;

  /**
   * Ordered array of Course UUIDs.
   * Stored as a simple-array; iterate to build course list.
   */
  @Column("simple-array", { nullable: true })
  courseIds?: string[];

  @Column({ type: "integer", default: 0 })
  estimatedDurationMinutes!: number;

  /** Denormalised enrolment count */
  @Column({ type: "integer", default: 0 })
  enrollmentCount!: number;

  @Column("simple-array", { nullable: true })
  tags?: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
