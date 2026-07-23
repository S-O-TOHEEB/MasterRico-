import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from "typeorm";
import { User } from "./User.js";
import { Course } from "./Course.js";

export enum DiscussionCategory {
  GENERAL   = "general",
  QUESTION  = "question",
  FEEDBACK  = "feedback",
  BUG       = "bug",
}

@Entity("discussion_posts")
export class DiscussionPost {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  authorId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "authorId" })
  author!: User;

  /** Course the thread belongs to */
  @Column({ type: "uuid" })
  courseId!: string;

  @ManyToOne(() => Course)
  @JoinColumn({ name: "courseId" })
  course!: Course;

  /** Optionally scoped to a specific lesson */
  @Column({ type: "uuid", nullable: true })
  lessonId?: string;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text" })
  body!: string;

  @Column({ type: "enum", enum: DiscussionCategory, default: DiscussionCategory.GENERAL })
  category!: DiscussionCategory;

  @Column({ type: "integer", default: 0 })
  upvoteCount!: number;

  @Column({ type: "integer", default: 0 })
  replyCount!: number;

  /** Pinned by creator or admin */
  @Column({ type: "boolean", default: false })
  isPinned!: boolean;

  @Column({ type: "boolean", default: false })
  isResolved!: boolean;

  @Column({ type: "boolean", default: false })
  isFlagged!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
