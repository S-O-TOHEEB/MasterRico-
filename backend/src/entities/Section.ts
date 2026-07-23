import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from "typeorm";
import { Course } from "./Course.js";
import { Lesson } from "./Lesson.js";

@Entity("sections")
export class Section {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({type:"varchar"})
  title!: string;

  @Column({type:"int"})
  orderIndex!: number;

  @Column({type:"uuid"})
  courseId!: string;

  @ManyToOne(() => Course)
  course!: Course;

  @OneToMany(() => Lesson, (lesson) => lesson.section)
  lessons!: Lesson[];

  @CreateDateColumn({type:"timestamp"})
  createdAt!: Date;

  @UpdateDateColumn({type:"timestamp"})
  updatedAt!: Date;
}
