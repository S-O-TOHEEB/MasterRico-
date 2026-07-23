import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User.js";
import { Conversation } from "./Conversation.js";

@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  conversationId!: string;

  @ManyToOne(() => Conversation)
  @JoinColumn({ name: "conversationId" })
  conversation!: Conversation;

  @Column({ type: "uuid" })
  senderId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "senderId" })
  sender!: User;

  @Column({ type: "text" })
  body!: string;

  @Column({ type: "boolean", default: false })
  isRead!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
