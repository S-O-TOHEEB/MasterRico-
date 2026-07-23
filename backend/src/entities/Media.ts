import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from "typeorm";
import { User } from "./User.js";

export enum MediaType {
  VIDEO = "video",
  DOCUMENT = "document",
  IMAGE = "image",
  OTHER = "other",
}

/**
 * READY is the default and immediate state for images/documents (the
 * S3/Cloudinary/local upload already has a real URL by the time POST /media
 * is called). PROCESSING is video-only — see MediaController.createVideoUpload
 * and WebhookService.handleMuxEvent for the full lifecycle: a video row is
 * created as PROCESSING with no fileUrl yet, and Mux's webhook flips it to
 * READY (with the real HLS URL) or ERRORED once transcoding finishes.
 */
export enum MediaProcessingStatus {
  READY = "ready",
  PROCESSING = "processing",
  ERRORED = "errored",
}

@Entity("media")
export class Media {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({type:"varchar"})
  fileName!: string;

  /** Nullable — a video row has no URL yet while status is PROCESSING. */
  @Column({type:"varchar", nullable: true})
  fileUrl?: string;

  @Column({
    type: "enum",
    enum: MediaType,
    default: MediaType.DOCUMENT,
  })
  type!: MediaType;

  @Column({ type: "enum", enum: MediaProcessingStatus, default: MediaProcessingStatus.READY })
  status!: MediaProcessingStatus;

  @Column({type:"varchar", nullable: true })
  mimeType?: string;

  @Column({ type: "bigint", nullable: true })
  sizeBytes?: number;

  // ── Video only (Mux) — see WebhookService.handleMuxEvent ──────────────────
  @Column({ type: "varchar", nullable: true })
  muxUploadId?: string;

  @Column({ type: "varchar", nullable: true })
  muxAssetId?: string;

  @Column({ type: "varchar", nullable: true })
  muxPlaybackId?: string;

  @Column({ type: "varchar", nullable: true })
  thumbnailUrl?: string;

  @Column({ type: "integer", nullable: true })
  durationSeconds?: number;

  @ManyToOne(() => User)
  uploader!: User;

  @Column("uuid")
  uploaderId!: string;

  @CreateDateColumn({type:"timestamp"})
  createdAt!: Date;

  @UpdateDateColumn({type:"timestamp"})
  updatedAt!: Date;
}
