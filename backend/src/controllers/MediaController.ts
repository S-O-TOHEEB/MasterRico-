import type { Request, Response } from "express";
import { MediaService } from "../services/MediaService.js";
import { UserRole } from "../entities/User.js";
import { param } from "../utils/params.js";

const service = new MediaService();

export const getUploadUrl = async (req: Request, res: Response) => {
  try {
    const { fileName, fileType } = req.body;
    const result = await service.getUploadUrl(req.user!.id, fileName, fileType);
    res.json(result);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

// POST /media/local-upload — multipart/form-data, field "file". Only functional
// when STORAGE_PROVIDER=local; the client reaches this via the uploadUrl
// returned from POST /media/upload-url.
export const localUpload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded — expected multipart field \"file\"" });
    }
    const accessUrl = service.buildLocalAccessUrl(req.file.filename);
    res.status(201).json({
      fileName: req.file.originalname,
      accessUrl,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    });
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

// POST /media/video/upload — creates the Media row (PROCESSING) + a Mux
// direct upload session in one step. Poll GET /media/:id for completion —
// there's no separate status endpoint; WebhookService.handleMuxEvent flips
// status to READY (or ERRORED) once Mux calls back.
export const createVideoUpload = async (req: Request, res: Response) => {
  try {
    const { fileName, mimeType } = req.body;
    const session = await service.createVideoUpload(req.user!.id, fileName, mimeType);
    res.status(201).json(session);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

// DELETE /media/:id — owner only. Best-effort remote cleanup; DB row is
// always removed even if the remote object can't be (see StorageService.deleteObject).
export const deleteMedia = async (req: Request, res: Response) => {
  try {
    await service.remove(param(req, "id"), req.user!.id);
    res.json({ success: true, message: "Media deleted" });
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const recordMedia = async (req: Request, res: Response) => {
  try {
    const media = await service.record({ ...req.body, uploaderId: req.user!.id });
    res.status(201).json(media);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

// GET /media/:id — owner or admin only. Media can hold private
// documents/videos, so this is the same access rule as deleteMedia below,
// not open to any authenticated user.
export const getMedia = async (req: Request, res: Response) => {
  try {
    const media = await service.findById(param(req, "id"));
    if (!media) return res.status(404).json({ message: "Media not found" });
    if (media.uploaderId !== req.user!.id && req.user!.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.json(media);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
};

export const myMedia = async (req: Request, res: Response) => {
  try {
    const media = await service.findByUploader(req.user!.id);
    res.json(media);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
};
