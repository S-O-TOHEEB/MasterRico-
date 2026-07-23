import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from "typeorm";
import { User } from "./User.js";
import { DiscussionPost } from "./DiscussionPost.js";

@Entity("discussion_replies")
export class DiscussionReply {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  authorId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "authorId" })
  author!: User;

  @Column({ type: "uuid" })
  postId!: string;

  @ManyToOne(() => DiscussionPost)
  @JoinColumn({ name: "postId" })
  post!: DiscussionPost;

  @Column({ type: "text" })
  body!: string;

  @Column({ type: "integer", default: 0 })
  upvoteCount!: number;

  /** Creator or admin marks one reply as the accepted answer */
  @Column({ type: "boolean", default: false })
  isAcceptedAnswer!: boolean;

  @Column({ type: "boolean", default: false })
  isFlagged!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
