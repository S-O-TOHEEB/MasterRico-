import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, type Relation } from "typeorm";
import { Course } from "./Course.js";
import { Section } from "./Section.js";

export enum LessonType {
  VIDEO = "video",
  TEXT = "text",
  QUIZ = "quiz",
  LIVE = "live",
}

@Entity("lessons")
export class Lesson {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({type:"varchar"})
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({
    type: "enum",
    enum: LessonType,
    default: LessonType.VIDEO,
  })
  type!: LessonType;

  @Column({ type:"varchar", nullable: true })
  videoUrl?: string;

  @Column({ type:"integer", nullable: true })
  durationSeconds?: number;

  @Column({type:"integer"})
  orderIndex!: number;

  @Column({type:"boolean", default: false })
  isPreviewable!: boolean;

  @Column("uuid")
  courseId!: string;

  @ManyToOne(() => Course)
  course!: Course;

  @Column({type:"varchar", nullable: true })
  sectionId?: string;

  @ManyToOne(() => Section, (section) => section.lessons)
  section?: Relation<Section>;

  @CreateDateColumn({type:"timestamp"})
  createdAt!: Date;

  @UpdateDateColumn({type:"timestamp"})
  updatedAt!: Date;
}
