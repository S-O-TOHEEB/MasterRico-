import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from "typeorm";
import { User } from "./User.js";
import { Course } from "./Course.js";

export enum LiveSessionType {
  QA        = "qa",         // free Q&A — open to all registered users
  CLASS     = "class",      // structured live lesson — Learner Pro only
  WORKSHOP  = "workshop",   // paid one-off event
}

export enum LiveSessionStatus {
  SCHEDULED  = "scheduled",
  LIVE       = "live",
  ENDED      = "ended",
  CANCELLED  = "cancelled",
}

@Entity("live_sessions")
export class LiveSession {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  hostId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "hostId" })
  host!: User;

  /** Optional — session can be standalone or tied to a course */
  @Column({ type: "uuid", nullable: true })
  courseId?: string;

  @ManyToOne(() => Course, { nullable: true })
  @JoinColumn({ name: "courseId" })
  course?: Course;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "enum", enum: LiveSessionType, default: LiveSessionType.QA })
  type!: LiveSessionType;

  @Column({ type: "enum", enum: LiveSessionStatus, default: LiveSessionStatus.SCHEDULED })
  status!: LiveSessionStatus;

  @Column({ type: "timestamp" })
  scheduledAt!: Date;

  @Column({ type: "integer", default: 60 })
  durationMinutes!: number;

  /** Max attendees — 0 = unlimited */
  @Column({ type: "integer", default: 0 })
  maxAttendees!: number;

  @Column({ type: "integer", default: 0 })
  rsvpCount!: number;

  /**
   * Populated when the session goes LIVE. Holds the LiveKit server URL to
   * connect to (the same for every session) — the room-specific part is
   * `roomName` below. Clients still need a per-participant token from
   * GET /live-sessions/:id/token to actually join; this URL alone isn't
   * enough (LiveKit auth is per-identity, not per-room).
   */
  @Column({ type: "varchar", nullable: true })
  streamUrl?: string;

  /** The LiveKit room name backing this session, set when it goes LIVE. */
  @Column({ type: "varchar", nullable: true })
  roomName?: string;

  /** Recording URL after session ends */
  @Column({ type: "varchar", nullable: true })
  recordingUrl?: string;

  /** Price in pence — 0 for free Q&A sessions */
  @Column({ type: "integer", default: 0 })
  pricePence!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/** RSVP — who has registered for a session */
@Entity("live_session_rsvps")
export class LiveSessionRsvp {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  sessionId!: string;

  @ManyToOne(() => LiveSession)
  @JoinColumn({ name: "sessionId" })
  session!: LiveSession;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @CreateDateColumn()
  registeredAt!: Date;
}
