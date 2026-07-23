import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from "typeorm";
import { User } from "./User.js";

@Entity("user_streaks")
export class UserStreak {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", unique: true })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  /** Number of consecutive days the learner completed at least one lesson */
  @Column({ type: "integer", default: 0 })
  currentStreak!: number;

  /** All-time record */
  @Column({ type: "integer", default: 0 })
  longestStreak!: number;

  /** Total days with at least one lesson completed (not necessarily consecutive) */
  @Column({ type: "integer", default: 0 })
  totalActiveDays!: number;

  /** Date portion (YYYY-MM-DD) of the last day a lesson was completed */
  @Column({ type: "date", nullable: true })
  lastActivityDate?: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
