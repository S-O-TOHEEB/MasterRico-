import axios from "axios";
import logger from "../utils/logger.js";

const MUX_API = "https://api.mux.com";

export interface MuxUploadSession {
  uploadId: string;
  uploadUrl: string;
}

function muxAuth(): { username: string; password: string } {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error("Video upload is not configured — set MUX_TOKEN_ID and MUX_TOKEN_SECRET");
  }
  return { username: tokenId, password: tokenSecret };
}

/**
 * Real Mux integration for video-specific storage/streaming.
 *
 * Architecture: browser → Mux Direct Upload (TUS) → Mux processes the video
 * → Mux webhook → backend marks it READY → frontend picks that up. This
 * class only handles the first step (creating the upload session) — Mux's
 * direct-upload endpoint expects the file to arrive via a resumable (TUS)
 * upload, a client-side protocol (the frontend should use Mux's own
 * `@mux/upchunk` or `@mux/mux-uploader-react` against the `uploadUrl` this
 * returns; the byte transfer happens directly between the browser and Mux,
 * same as the S3/Cloudinary paths never route file bytes through this
 * server either). Completion is entirely webhook-driven from here on — see
 * WebhookService.handleMuxEvent — deliberately no polling method.
 */
export class MuxService {
  /**
   * @param passthrough Echoed back verbatim on every Mux webhook event for
   *   the resulting asset — MediaController.createVideoUpload passes its own
   *   Media row's id here so the webhook can find its way back to the right
   *   row without any other lookup.
   */
  async createUploadSession(passthrough: string): Promise<MuxUploadSession> {
    const auth = muxAuth();
    try {
      const response = await axios.post(
        `${MUX_API}/video/v1/uploads`,
        {
          cors_origin: process.env.CORS_ORIGINS?.split(",")[0] ?? "*",
          new_asset_settings: {
            playback_policy: ["public"],
            passthrough,
          },
        },
        { auth }
      );
      const data = response.data.data;
      return { uploadId: data.id, uploadUrl: data.url };
    } catch (error: any) {
      logger.error("[MuxService] Failed to create upload session", error.response?.data || error.message);
      throw new Error("Failed to create video upload session");
    }
  }
}
