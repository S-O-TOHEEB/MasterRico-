import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Unique } from "typeorm";
import { User } from "./User.js";
import { Lesson } from "./Lesson.js";

@Entity("lesson_progress")
@Unique(["userId", "lessonId"])
export class LessonProgress {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  userId!: string;

  @ManyToOne(() => User)
  user!: User;

  @Column("uuid")
  lessonId!: string;

  @ManyToOne(() => Lesson)
  lesson!: Lesson;

  @Column({ type:"int", default: 0 })
  watchedSeconds!: number;

  @Column({ type:"boolean",default: false })
  isCompleted!: boolean;

  @Column({ type: "timestamp", nullable: true })
  completedAt?: Date;

  @CreateDateColumn({type:"timestamp"})
  createdAt!: Date;

  @UpdateDateColumn({type:"timestamp"})
  updatedAt!: Date;
}
