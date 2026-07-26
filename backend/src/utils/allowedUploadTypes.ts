/**
 * Allow-list for POST /media/upload-url and /media/local-upload — the
 * generic image/document upload path (video has its own dedicated Mux
 * flow, see MuxService, and isn't covered by this list). Neither the local
 * multer config nor the S3/Cloudinary presigned-URL path validated file
 * type before this — any file type could be uploaded and then served
 * directly from /uploads via express.static, meaning an uploaded
 * .html/.svg would be served with a browser-executable content type from
 * the API's own origin (stored XSS / phishing hosted on this
 * infrastructure). HTML and SVG are deliberately excluded even though
 * they're technically "documents" — SVG can carry embedded scripts.
 */
export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",       // .xlsx
  "text/plain",
]);

export function isAllowedUploadType(mimeType: string | undefined): boolean {
  return !!mimeType && ALLOWED_UPLOAD_MIME_TYPES.has(mimeType.toLowerCase());
}
