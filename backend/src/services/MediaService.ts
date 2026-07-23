import { AppDataSource } from "../config/database.js";
import { Media, MediaType, MediaProcessingStatus } from "../entities/Media.js";
import { StorageService } from "./StorageService.js";
import { MuxService } from "./MuxService.js";

const mediaRepo = () => AppDataSource.getRepository(Media);
const storage = new StorageService();
const mux = new MuxService();

export class MediaService {
  /** Images/documents — S3, Cloudinary, or local disk depending on STORAGE_PROVIDER. */
  async getUploadUrl(uploaderId: string, fileName: string, fileType: string) {
    return storage.getPresignedUploadUrl(fileName, fileType, uploaderId);
  }

  /** Local-provider only: turns a multer-saved filename into a fetchable URL. */
  buildLocalAccessUrl(storedFileName: string) {
    return storage.buildLocalAccessUrl(storedFileName);
  }

  /**
   * Video — creates the Media row up front (status: PROCESSING, no fileUrl
   * yet) and a Mux direct upload session, passing the row's own id as Mux's
   * passthrough so WebhookService.handleMuxEvent can find its way back here
   * once transcoding finishes. See MuxService for why video can't just
   * reuse getUploadUrl the way images/documents do.
   */
  async createVideoUpload(uploaderId: string, fileName: string, mimeType?: string) {
    if (!fileName?.trim()) {
      throw new Error("fileName is required");
    }

    const media = mediaRepo().create({
      uploaderId,
      fileName,
      type: MediaType.VIDEO,
      status: MediaProcessingStatus.PROCESSING,
      mimeType,
    });
    const saved = await mediaRepo().save(media);

    try {
      const session = await mux.createUploadSession(saved.id);
      await mediaRepo().update(saved.id, { muxUploadId: session.uploadId });
      return { mediaId: saved.id, uploadUrl: session.uploadUrl };
    } catch (error) {
      // Don't leave an orphaned PROCESSING row with no muxUploadId and no
      // way to ever complete — this is the common case in any environment
      // where Mux isn't configured yet, not just a rare network blip.
      await mediaRepo().remove(saved);
      throw error;
    }
  }

  async record(data: {
    uploaderId: string;
    fileName: string;
    fileUrl: string;
    type?: MediaType;
    mimeType?: string;
    sizeBytes?: number;
  }): Promise<Media> {
    const media = mediaRepo().create({
      uploaderId: data.uploaderId,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      type: data.type ?? MediaType.DOCUMENT,
      status: MediaProcessingStatus.READY,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
    });
    return mediaRepo().save(media);
  }

  async findById(id: string): Promise<Media | null> {
    return mediaRepo().findOne({ where: { id } });
  }

  async findByUploader(uploaderId: string): Promise<Media[]> {
    return mediaRepo().find({ where: { uploaderId }, order: { createdAt: "DESC" } });
  }

  async remove(id: string, uploaderId: string): Promise<void> {
    const media = await mediaRepo().findOneBy({ id });
    if (!media) throw new Error("Media not found");
    if (media.uploaderId !== uploaderId) throw new Error("Access denied");

    if (media.fileUrl) {
      await storage.deleteObject(media.fileUrl);
    }
    await mediaRepo().remove(media);
  }
}
