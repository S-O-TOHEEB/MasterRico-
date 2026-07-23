import multer from "multer";
import path from "path";
import fs from "fs";
import type { Request } from "express";

/**
 * Disk storage backing STORAGE_PROVIDER=local. Only meaningful for local
 * dev — on Render this directory is ephemeral across redeploys/restarts
 * unless a persistent disk is attached, so production should use
 * STORAGE_PROVIDER=s3 or =cloudinary instead.
 */
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 100);
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req: Request, file, cb) => {
    const userId = req.user?.id ?? "anon";
    const ext = path.extname(file.originalname);
    const base = sanitize(path.basename(file.originalname, ext));
    cb(null, `${userId}-${Date.now()}-${base}${ext}`);
  },
});

export const localUploadMiddleware = multer({
  storage: diskStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB — large video should go through /media/video/upload (Mux) instead
});
