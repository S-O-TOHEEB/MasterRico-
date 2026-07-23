import { AppDataSource } from "../config/database.js";
import { Notification, NotificationType } from "../entities/Notification.js";

interface CreateNotificationDto {
  type:          NotificationType;
  title:         string;
  message:       string;
  resourceId?:   string;
  resourceType?: string;
}

export class NotificationService {
  private notifRepo = AppDataSource.getRepository(Notification);

  async create(userId: string, dto: CreateNotificationDto): Promise<Notification> {
    const notif = this.notifRepo.create({ userId, ...dto });
    return this.notifRepo.save(notif);
  }

  async listByUser(
    userId: string, page = 1, limit = 30
  ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    const [notifications, total] = await this.notifRepo.findAndCount({
      where: { userId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unreadCount = await this.notifRepo.countBy({ userId, isRead: false });

    return { notifications, total, unreadCount };
  }

  async markRead(notifId: string, userId: string): Promise<void> {
    await this.notifRepo.update({ id: notifId, userId }, { isRead: true });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notifRepo.countBy({ userId, isRead: false });
  }
}
