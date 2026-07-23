import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import {
  getUploadUrl, recordMedia, getMedia, myMedia,
  localUpload, createVideoUpload, deleteMedia,
} from "../controllers/MediaController.js";
import { authenticate } from "../middlewares/auth.js";
import { localUploadMiddleware } from "../middlewares/upload.js";

const router = createRouter();

// Images/documents — S3, Cloudinary, or local depending on STORAGE_PROVIDER
router.post("/upload-url", authenticate, getUploadUrl);
router.post("/local-upload", authenticate, localUploadMiddleware.single("file"), localUpload);

// Video — Mux direct upload session. Completion is webhook-driven (see
// POST /webhooks/mux) — poll GET /media/:id below for status, no separate
// video-status endpoint.
router.post("/video/upload", authenticate, createVideoUpload);

router.post("/", authenticate, recordMedia);
router.get("/my", authenticate, myMedia);
router.get("/:id", authenticate, getMedia);
router.delete("/:id", authenticate, deleteMedia);

export default router;
