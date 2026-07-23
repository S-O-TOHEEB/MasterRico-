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

/**
 * Direct 1:1 conversations only, matching the frontend's "direct
 * creator↔learner messaging" feature (no group chat).
 *
 * participantAId is always the lexicographically smaller of the two user
 * ids (see MessageService.orderPair), so the unique constraint on the pair
 * prevents duplicate conversations regardless of who started it.
 */
@Entity("conversations")
@Unique(["participantAId", "participantBId"])
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  participantAId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "participantAId" })
  participantA!: User;

  @Column({ type: "uuid" })
  participantBId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "participantBId" })
  participantB!: User;

  /** Denormalised for a fast conversation-list view — updated on every send */
  @Column({ type: "text", nullable: true })
  lastMessagePreview?: string;

  @Column({ type: "timestamp", nullable: true })
  lastMessageAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
