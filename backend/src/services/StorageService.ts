import { PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import fs from "fs";
import logger from "../utils/logger.js";

export type StorageProvider = "s3" | "cloudinary" | "local";

export interface S3UploadTarget {
  provider: "s3";
  uploadUrl: string;
  accessUrl: string;
  key: string;
}

export interface CloudinaryUploadTarget {
  provider: "cloudinary";
  uploadUrl: string;
  fields: { api_key: string | undefined; timestamp: number; folder: string; signature: string };
  note: string;
}

export interface LocalUploadTarget {
  provider: "local";
  uploadUrl: string;
  note: string;
}

export type UploadTarget = S3UploadTarget | CloudinaryUploadTarget | LocalUploadTarget;

function sanitizeFileName(fileName: string): string {
  const ext = path.extname(fileName);
  const base = path
    .basename(fileName, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);
  return `${base}${ext}`;
}

/**
 * Real file storage, provider-selected via STORAGE_PROVIDER (s3 | cloudinary | local).
 *
 * s3 and cloudinary both hand the client a direct-upload target (a presigned
 * PUT for S3, a signed form-field set for Cloudinary) — the file bytes never
 * pass through this backend. local is a genuine working dev fallback: it
 * points the client at this server's own POST /media/local-upload endpoint,
 * which writes to disk via multer. local is NOT recommended for production
 * on Render — its filesystem is ephemeral on redeploy/restart unless a
 * persistent disk is attached.
 *
 * Video files should use MuxService instead of this class — Mux needs a
 * resumable (TUS) upload protocol that a plain presigned PUT can't provide.
 */
export class StorageService {
  private provider: StorageProvider;
  private s3?: S3Client;
  private bucket?: string;
  private region: string;
  private cdnBaseUrl?: string;

  constructor() {
    this.provider = (process.env.STORAGE_PROVIDER as StorageProvider) || "local";
    this.region = process.env.AWS_REGION || "eu-west-2";

    if (this.provider === "s3") {
      this.bucket = process.env.AWS_S3_BUCKET;
      this.cdnBaseUrl = process.env.AWS_CLOUDFRONT_URL;

      if (!this.bucket || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        logger.warn(
          "[StorageService] STORAGE_PROVIDER=s3 but AWS_S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY " +
            "are not fully set — presigned URL requests will fail until they are."
        );
      }

      this.s3 = new S3Client({
        region: this.region,
        credentials:
          process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
              }
            : undefined,
      });
    }

    if (this.provider === "cloudinary") {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        logger.warn(
          "[StorageService] STORAGE_PROVIDER=cloudinary but CLOUDINARY_CLOUD_NAME is not set — " +
            "signed upload requests will fail until it is."
        );
      }
    }
  }

  getProvider(): StorageProvider {
    return this.provider;
  }

  async getPresignedUploadUrl(fileName: string, fileType: string, uploaderId: string): Promise<UploadTarget> {
    const key = `uploads/${uploaderId}/${Date.now()}-${sanitizeFileName(fileName)}`;

    if (this.provider === "s3") {
      if (!this.s3 || !this.bucket) {
        throw new Error("S3 storage is not configured — set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY");
      }
      const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: fileType });
      const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 900 }); // 15 minutes
      const accessUrl = this.cdnBaseUrl
        ? `${this.cdnBaseUrl}/${key}`
        : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
      return { provider: "s3", uploadUrl, accessUrl, key };
    }

    if (this.provider === "cloudinary") {
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_SECRET) {
        throw new Error("Cloudinary storage is not configured — set CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET");
      }
      const timestamp = Math.round(Date.now() / 1000);
      const folder = `edustream/${uploaderId}`;
      const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET);
      return {
        provider: "cloudinary",
        uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
        fields: { api_key: process.env.CLOUDINARY_API_KEY, timestamp, folder, signature },
        note:
          "POST multipart/form-data directly to uploadUrl with these fields plus your file. " +
          "Cloudinary's response contains `secure_url` — pass THAT as fileUrl to POST /media, " +
          "since Cloudinary decides the final URL, not this backend.",
      };
    }

    // local — real disk storage for dev only, via this backend's own endpoint.
    return {
      provider: "local",
      uploadUrl: `${this.localBaseUrl()}/api/v1/media/local-upload`,
      note:
        "POST multipart/form-data with a 'file' field (same auth header as this request). " +
        "The response contains the real accessUrl to pass to POST /media.",
    };
  }

  /** Used by the local-upload controller once multer has written the file to disk. */
  buildLocalAccessUrl(storedFileName: string): string {
    return `${this.localBaseUrl()}/uploads/${storedFileName}`;
  }

  /**
   * Best-effort remote cleanup when a Media row is deleted. Never throws —
   * a failed/impossible remote delete shouldn't block removing the DB
   * record, so callers should treat this as advisory, not authoritative.
   */
  async deleteObject(fileUrl: string): Promise<void> {
    try {
      if (this.provider === "s3" && this.s3 && this.bucket) {
        const marker = this.cdnBaseUrl ? `${this.cdnBaseUrl}/` : `.amazonaws.com/`;
        const idx = fileUrl.indexOf(marker);
        if (idx === -1) return;
        const key = fileUrl.slice(idx + marker.length);
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
        return;
      }

      if (this.provider === "local") {
        const marker = "/uploads/";
        const idx = fileUrl.indexOf(marker);
        if (idx === -1) return;
        const fileName = fileUrl.slice(idx + marker.length);
        const filePath = path.join(process.cwd(), "uploads", fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return;
      }

      // Cloudinary: reliably reconstructing the public_id from a delivery
      // URL (folders, versioning, format transforms) is fragile enough that
      // getting it wrong risks deleting the wrong asset — so this
      // deliberately does nothing for that provider. The DB row still gets
      // removed either way; the file is just orphaned in Cloudinary until
      // cleaned up separately.
    } catch (err) {
      logger.warn(`[StorageService] Best-effort delete failed for ${fileUrl} — DB record will still be removed`, err);
    }
  }

  private localBaseUrl(): string {
    return process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
  }
}
