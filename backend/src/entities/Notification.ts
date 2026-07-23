import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from "typeorm";
import { User } from "./User.js";

export enum NotificationType {
  NEW_ENROLLMENT   = "new_enrollment",    // creator: someone enrolled
  NEW_REVIEW       = "new_review",        // creator: someone left a review
  NEW_REPLY        = "new_reply",         // learner/creator: reply on their post
  COURSE_PUBLISHED = "course_published",  // follower: creator published a course
  CERTIFICATE      = "certificate",       // learner: certificate issued
  PAYMENT_SUCCESS  = "payment_success",   // learner: payment confirmed
  SYSTEM           = "system",            // platform announcements
}

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({ type: "enum", enum: NotificationType })
  type!: NotificationType;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text" })
  message!: string;

  /** Optional deep-link: course ID, discussion post ID, etc. */
  @Column({ type: "varchar", nullable: true })
  resourceId?: string;

  @Column({ type: "varchar", nullable: true })
  resourceType?: string;

  @Column({ type: "boolean", default: false })
  isRead!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
