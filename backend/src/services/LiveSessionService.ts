import { AppDataSource } from "../config/database.js";
import {
  LiveSession, LiveSessionRsvp,
  LiveSessionType, LiveSessionStatus,
} from "../entities/LiveSession.js";
import { User } from "../entities/User.js";
import { NotificationService } from "./NotificationService.js";
import { NotificationType } from "../entities/Notification.js";
import { LiveKitService } from "./LiveKitService.js";
import logger from "../utils/logger.js";

interface CreateSessionDto {
  title:           string;
  description?:    string;
  type?:           LiveSessionType;
  scheduledAt:     string; // ISO string
  durationMinutes?: number;
  maxAttendees?:   number;
  courseId?:       string;
  pricePence?:     number;
}

export class LiveSessionService {
  private sessionRepo = AppDataSource.getRepository(LiveSession);
  private rsvpRepo    = AppDataSource.getRepository(LiveSessionRsvp);
  private userRepo    = AppDataSource.getRepository(User);
  private notifSvc    = new NotificationService();
  private liveKit     = new LiveKitService();

  async create(hostId: string, dto: CreateSessionDto): Promise<LiveSession> {
    const session = this.sessionRepo.create({
      hostId,
      title:           dto.title,
      description:     dto.description,
      type:            dto.type ?? LiveSessionType.QA,
      status:          LiveSessionStatus.SCHEDULED,
      scheduledAt:     new Date(dto.scheduledAt),
      durationMinutes: dto.durationMinutes ?? 60,
      maxAttendees:    dto.maxAttendees ?? 0,
      courseId:        dto.courseId,
      pricePence:      dto.pricePence ?? 0,
    });
    return this.sessionRepo.save(session);
  }

  async listUpcoming(page = 1, limit = 20) {
    const [sessions, total] = await this.sessionRepo.findAndCount({
      where: { status: LiveSessionStatus.SCHEDULED },
      relations: ["host", "course"],
      order: { scheduledAt: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { sessions, total };
  }

  async listByCreator(hostId: string): Promise<LiveSession[]> {
    return this.sessionRepo.find({
      where: { hostId },
      order: { scheduledAt: "DESC" },
    });
  }

  async getById(sessionId: string): Promise<LiveSession> {
    const s = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ["host", "course"],
    });
    if (!s) throw new Error("Session not found");
    return s;
  }

  async update(
    sessionId: string, hostId: string,
    dto: Partial<CreateSessionDto>
  ): Promise<LiveSession> {
    const s = await this.findOwnedOrFail(sessionId, hostId);
    if (dto.scheduledAt) s.scheduledAt = new Date(dto.scheduledAt);
    if (dto.title)           s.title           = dto.title;
    if (dto.description)     s.description     = dto.description;
    if (dto.durationMinutes) s.durationMinutes = dto.durationMinutes;
    if (dto.maxAttendees)    s.maxAttendees    = dto.maxAttendees;
    if (dto.pricePence !== undefined) s.pricePence = dto.pricePence;
    return this.sessionRepo.save(s);
  }

  async cancel(sessionId: string, hostId: string): Promise<LiveSession> {
    const s = await this.findOwnedOrFail(sessionId, hostId);
    s.status = LiveSessionStatus.CANCELLED;
    const saved = await this.sessionRepo.save(s);

    // Notify all RSVPs
    const rsvps = await this.rsvpRepo.findBy({ sessionId });
    await Promise.all(rsvps.map(r =>
      this.notifSvc.create(r.userId, {
        type:         NotificationType.SYSTEM,
        title:        "Live session cancelled",
        message:      `"${s.title}" scheduled for ${s.scheduledAt.toDateString()} has been cancelled.`,
        resourceId:   sessionId,
        resourceType: "live_session",
      })
    ));

    return saved;
  }

  /** Creator starts the session — creates the real LiveKit room and marks it LIVE. */
  async goLive(sessionId: string, hostId: string): Promise<LiveSession> {
    const s = await this.findOwnedOrFail(sessionId, hostId);
    const roomName = s.roomName ?? `session-${sessionId}`;

    await this.liveKit.ensureRoom(roomName, s.maxAttendees);

    s.status = LiveSessionStatus.LIVE;
    s.roomName = roomName;
    s.streamUrl = process.env.LIVEKIT_URL;
    logger.info(`[LiveSessionService] Session ${sessionId} is now LIVE (room ${roomName})`);
    return this.sessionRepo.save(s);
  }

  /**
   * Mints a join token for whoever's asking — host or an RSVP'd attendee.
   * QA sessions let attendees publish (unmute/ask on camera); CLASS and
   * WORKSHOP sessions are host-only publish, subscribe-only for attendees,
   * matching the entity's existing "structured lesson" vs "open Q&A" intent.
   */
  async getJoinToken(sessionId: string, userId: string) {
    const s = await this.sessionRepo.findOneBy({ id: sessionId });
    if (!s) throw new Error("Session not found");
    if (!s.roomName || s.status !== LiveSessionStatus.LIVE) {
      throw new Error("Session is not live yet");
    }

    const isHost = s.hostId === userId;
    if (!isHost) {
      const rsvp = await this.rsvpRepo.findOneBy({ sessionId, userId });
      if (!rsvp) throw new Error("You need to RSVP before joining this session");
    }

    const user = await this.userRepo.findOneBy({ id: userId });
    const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : userId;
    const canPublish = isHost || s.type === LiveSessionType.QA;

    return this.liveKit.createToken(s.roomName, userId, displayName, canPublish);
  }

  async endSession(sessionId: string, hostId: string): Promise<LiveSession> {
    const s = await this.findOwnedOrFail(sessionId, hostId);
    if (s.roomName) {
      // Best-effort — ending the session in our DB should never fail just
      // because LiveKit cleanup couldn't run (e.g. not configured, or the
      // room's already gone).
      try {
        await this.liveKit.endRoom(s.roomName);
      } catch (err) {
        logger.warn(`[LiveSessionService] Failed to tear down LiveKit room ${s.roomName}`, err);
      }
    }
    s.status = LiveSessionStatus.ENDED;
    return this.sessionRepo.save(s);
  }

  // ── RSVP ─────────────────────────────────────────────────────────────────────

  async rsvp(sessionId: string, userId: string): Promise<LiveSessionRsvp> {
    const s = await this.sessionRepo.findOneBy({ id: sessionId });
    if (!s) throw new Error("Session not found");
    if (s.status !== LiveSessionStatus.SCHEDULED) throw new Error("Session is not open for RSVPs");

    const existing = await this.rsvpRepo.findOneBy({ sessionId, userId });
    if (existing) throw new Error("Already registered");

    // Atomic, race-safe capacity check: the increment only applies if the
    // WHERE clause still holds when the DB executes it, so two concurrent
    // RSVPs can't both squeeze through when only one seat is left (the
    // previous read-then-write version could, since two requests could both
    // read rsvpCount < maxAttendees before either had incremented it).
    if (s.maxAttendees > 0) {
      const result = await this.sessionRepo
        .createQueryBuilder()
        .update(LiveSession)
        .set({ rsvpCount: () => '"rsvpCount" + 1' })
        .where("id = :id", { id: sessionId })
        .andWhere('"rsvpCount" < "maxAttendees"')
        .execute();
      if (!result.affected) throw new Error("Session is full");
    } else {
      await this.sessionRepo.increment({ id: sessionId }, "rsvpCount", 1);
    }

    const rsvp = this.rsvpRepo.create({ sessionId, userId });
    return this.rsvpRepo.save(rsvp);
  }

  async cancelRsvp(sessionId: string, userId: string): Promise<void> {
    const rsvp = await this.rsvpRepo.findOneBy({ sessionId, userId });
    if (!rsvp) throw new Error("RSVP not found");
    await this.rsvpRepo.remove(rsvp);
    await this.sessionRepo.decrement({ id: sessionId }, "rsvpCount", 1);
  }

  async listRsvps(sessionId: string, hostId: string) {
    await this.findOwnedOrFail(sessionId, hostId);
    return this.rsvpRepo.find({
      where: { sessionId },
      relations: ["user"],
    });
  }

  async getMyRsvps(userId: string): Promise<LiveSession[]> {
    const rsvps = await this.rsvpRepo.find({
      where: { userId },
      relations: ["session", "session.host"],
    });
    return rsvps.map(r => r.session);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async findOwnedOrFail(sessionId: string, hostId: string): Promise<LiveSession> {
    const s = await this.sessionRepo.findOneBy({ id: sessionId, hostId });
    if (!s) throw new Error("Session not found or access denied");
    return s;
  }
}
