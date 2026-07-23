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

export enum CourseStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

export enum DifficultyLevel {
  BEGINNER = "beginner",
  INTERMEDIATE = "intermediate",
  ADVANCED = "advanced",
}

@Entity("courses")
export class Course {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  creatorId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "creatorId" })
  creator!: User;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text" })
  description!: string;

  /** Short marketing blurb shown on cards / search results */
  @Column({ type: "varchar", length: 200, nullable: true })
  tagline?: string;

  @Column({ type: "integer", default: 0 })
  pricePence!: number;

  @Column({ type: "varchar", length: 3, default: "GBP" })
  currency!: string;

  @Column({
    type: "enum",
    enum: CourseStatus,
    default: CourseStatus.DRAFT,
  })
  status!: CourseStatus;

  @Column({ type: "varchar", nullable: true })
  thumbnailUrl?: string;

  @Column({
    type: "enum",
    enum: DifficultyLevel,
    nullable: true,
  })
  difficultyLevel?: DifficultyLevel;

  /** AI-generated + manually curated tags for search & discovery */
  @Column("simple-array", { nullable: true })
  tags?: string[];

  /** Outcome statements shown before a learner watches */
  @Column("simple-array", { nullable: true })
  learningOutcomes?: string[];

  /** Prerequisite skills as free-text strings */
  @Column("simple-array", { nullable: true })
  prerequisites?: string[];

  /** Estimated total duration in minutes */
  @Column({ type: "integer", default: 0 })
  estimatedDurationMinutes!: number;

  /** Cached from reviews — updated by ReviewService */
  @Column({ type: "decimal", precision: 3, scale: 2, default: 0 })
  averageRating!: number;

  @Column({ type: "integer", default: 0 })
  reviewCount!: number;

  /** EduStream quality score (0–100): depth + accuracy + outcomes */
  @Column({ type: "smallint", default: 0 })
  qualityScore!: number;

  /** Cached enrolment count */
  @Column({ type: "integer", default: 0 })
  enrollmentCount!: number;

  /** Total revenue in pence — for creator analytics */
  @Column({ type: "integer", default: 0 })
  totalRevenuePence!: number;

  @Column({ type: "varchar", nullable: true })
  language?: string;

  /** Intro / promo video URL */
  @Column({ type: "varchar", nullable: true })
  previewVideoUrl?: string;

  @Column("simple-array", { nullable: true })
  resourceUrls?: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
