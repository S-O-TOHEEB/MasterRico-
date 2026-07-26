import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from "typeorm";

export enum EngagementTargetType {
  REVIEW = "review",
  DISCUSSION_POST = "discussion_post",
  DISCUSSION_REPLY = "discussion_reply",
}

/**
 * One row per (user, target) — the unique constraint is the actual
 * enforcement mechanism, not an application-level check. ReviewService.markHelpful,
 * DiscussionService.upvotePost, and DiscussionService.upvoteReply all used
 * to be a bare `count++` with no record of who voted, so the same user
 * calling the endpoint in a loop could inflate a review's helpfulness or a
 * post's upvotes without limit (upvoteCount also feeds sort order/
 * qualityScore elsewhere). Attempt the INSERT first and only increment the
 * counter if it succeeds — that's race-safe under concurrent requests in a
 * way that "check then insert" isn't, since two simultaneous requests could
 * both pass a pre-check before either had inserted.
 */
@Entity("engagement_votes")
@Unique(["userId", "targetType", "targetId"])
export class EngagementVote {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "enum", enum: EngagementTargetType })
  targetType!: EngagementTargetType;

  @Column({ type: "uuid" })
  targetId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
