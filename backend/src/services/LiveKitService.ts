import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import logger from "../utils/logger.js";

export interface LiveKitJoinInfo {
  serverUrl: string;
  token: string;
}

function creds(): { apiKey: string; apiSecret: string; url: string } {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL; // e.g. wss://your-project.livekit.cloud
  if (!apiKey || !apiSecret || !url) {
    throw new Error("Live sessions are not configured — set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL");
  }
  return { apiKey, apiSecret, url };
}

// RoomServiceClient needs an http(s) host, not the ws(s):// URL clients
// connect with — LiveKit exposes both on the same host, so just swap scheme.
function toHttpHost(wsUrl: string): string {
  return wsUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

/**
 * Real LiveKit integration for live sessions. Unlike the S3/Cloudinary/Mux
 * paths, there's no single "join URL" to hand back — LiveKit clients connect
 * to the LiveKit server URL using a short-lived, per-identity JWT that
 * encodes what that specific participant is allowed to do in that specific
 * room. So this service's job is: (1) make sure the room exists server-side,
 * and (2) mint a token for whoever's asking to join, scoped to their role.
 */
export class LiveKitService {
  async ensureRoom(roomName: string, maxParticipants: number): Promise<void> {
    const { apiKey, apiSecret, url } = creds();
    const client = new RoomServiceClient(toHttpHost(url), apiKey, apiSecret);
    try {
      await client.createRoom({
        name: roomName,
        emptyTimeout: 3600, // close if nobody ever joins within an hour
        departureTimeout: 1800, // close 30 min after the last participant leaves
        maxParticipants: maxParticipants > 0 ? maxParticipants : undefined,
      });
    } catch (err: any) {
      // LiveKit's createRoom is idempotent in spirit but errors if the room
      // is already there — fine, goLive can be safely called again (e.g.
      // after a host reconnects).
      const message = String(err?.message ?? err).toLowerCase();
      if (!message.includes("already exists")) {
        logger.error("[LiveKitService] Failed to create room", err);
        throw new Error("Failed to create the live room — check LIVEKIT_* configuration");
      }
    }
  }

  async endRoom(roomName: string): Promise<void> {
    const { apiKey, apiSecret, url } = creds();
    const client = new RoomServiceClient(toHttpHost(url), apiKey, apiSecret);
    try {
      await client.deleteRoom(roomName);
    } catch (err) {
      // Already gone, or never actually created — not worth failing
      // endSession over.
      logger.debug("[LiveKitService] deleteRoom no-op", err);
    }
  }

  async createToken(
    roomName: string,
    identity: string,
    displayName: string,
    canPublish: boolean
  ): Promise<LiveKitJoinInfo> {
    const { apiKey, apiSecret, url } = creds();
    const at = new AccessToken(apiKey, apiSecret, { identity, name: displayName, ttl: "4h" });
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    });
    const token = await at.toJwt();
    return { serverUrl: url, token };
  }
}
