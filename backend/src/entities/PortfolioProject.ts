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

@Entity("portfolio_projects")
export class PortfolioProject {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  creatorId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "creatorId" })
  creator!: User;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "varchar", nullable: true })
  projectUrl?: string;

  @Column({ type: "varchar", nullable: true })
  imageUrl?: string;

  @Column({ type: "integer", default: 0 })
  orderIndex!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
