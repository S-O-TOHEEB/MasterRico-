import { AppDataSource } from "../config/database.js";
import { Enrollment, EnrollmentStatus } from "../entities/Enrollment.js";
import { UserStreak } from "../entities/UserStreak.js";
import { UserBadge } from "../entities/Badge.js";
import { User } from "../entities/User.js";

export type LeaderboardType = "completions" | "streaks" | "badges";
export type LeaderboardPeriod = "weekly" | "monthly" | "alltime";

export interface LeaderboardEntry {
  rank:        number;
  userId:      string;
  name:        string;
  avatarUrl?:  string;
  score:       number;
  label:       string; // "12 courses" / "45-day streak" / "8 badges"
}

export class LeaderboardService {
  private userRepo       = AppDataSource.getRepository(User);
  private enrollmentRepo = AppDataSource.getRepository(Enrollment);
  private streakRepo     = AppDataSource.getRepository(UserStreak);
  private badgeRepo      = AppDataSource.getRepository(UserBadge);

  async getLeaderboard(
    type: LeaderboardType,
    period: LeaderboardPeriod = "alltime",
    limit = 50,
  ): Promise<LeaderboardEntry[]> {
    switch (type) {
      case "completions": return this.byCompletions(period, limit);
      case "streaks":     return this.byStreaks(limit);
      case "badges":      return this.byBadges(limit);
      default:            throw new Error("Invalid leaderboard type");
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async byCompletions(
    period: LeaderboardPeriod, limit: number,
  ): Promise<LeaderboardEntry[]> {
    const qb = this.enrollmentRepo
      .createQueryBuilder("e")
      .innerJoin("e.user", "u")
      .select("e.userId", "userId")
      .addSelect("u.firstName", "firstName")
      .addSelect("u.lastName",  "lastName")
      .addSelect("u.profilePictureUrl", "avatarUrl")
      .addSelect("COUNT(e.id)", "count")
      .where("e.status = :status", { status: EnrollmentStatus.COMPLETED });

    if (period !== "alltime") {
      const since = new Date();
      period === "weekly"
        ? since.setDate(since.getDate() - 7)
        : since.setMonth(since.getMonth() - 1);
      qb.andWhere("e.updatedAt >= :since", { since });
    }

    const rows = await qb
      .groupBy("e.userId, u.firstName, u.lastName, u.profilePictureUrl")
      .orderBy("count", "DESC")
      .limit(limit)
      .getRawMany<{
        userId: string; firstName: string; lastName: string;
        avatarUrl: string; count: string;
      }>();

    return rows.map((r, i) => ({
      rank:     i + 1,
      userId:   r.userId,
      name:     `${r.firstName} ${r.lastName}`,
      avatarUrl: r.avatarUrl,
      score:    parseInt(r.count),
      label:    `${r.count} course${parseInt(r.count) !== 1 ? "s" : ""} completed`,
    }));
  }

  private async byStreaks(limit: number): Promise<LeaderboardEntry[]> {
    const rows = await this.streakRepo
      .createQueryBuilder("s")
      .innerJoin("s.user", "u")
      .select("s.userId",          "userId")
      .addSelect("u.firstName",    "firstName")
      .addSelect("u.lastName",     "lastName")
      .addSelect("u.profilePictureUrl", "avatarUrl")
      .addSelect("s.currentStreak","streak")
      .orderBy("s.currentStreak",  "DESC")
      .limit(limit)
      .getRawMany<{
        userId: string; firstName: string; lastName: string;
        avatarUrl: string; streak: number;
      }>();

    return rows.map((r, i) => ({
      rank:     i + 1,
      userId:   r.userId,
      name:     `${r.firstName} ${r.lastName}`,
      avatarUrl: r.avatarUrl,
      score:    r.streak,
      label:    `${r.streak}-day streak`,
    }));
  }

  private async byBadges(limit: number): Promise<LeaderboardEntry[]> {
    const rows = await this.badgeRepo
      .createQueryBuilder("ub")
      .innerJoin("ub.user", "u")
      .select("ub.userId",      "userId")
      .addSelect("u.firstName", "firstName")
      .addSelect("u.lastName",  "lastName")
      .addSelect("u.profilePictureUrl", "avatarUrl")
      .addSelect("COUNT(ub.id)", "count")
      .groupBy("ub.userId, u.firstName, u.lastName, u.profilePictureUrl")
      .orderBy("count", "DESC")
      .limit(limit)
      .getRawMany<{
        userId: string; firstName: string; lastName: string;
        avatarUrl: string; count: string;
      }>();

    return rows.map((r, i) => ({
      rank:     i + 1,
      userId:   r.userId,
      name:     `${r.firstName} ${r.lastName}`,
      avatarUrl: r.avatarUrl,
      score:    parseInt(r.count),
      label:    `${r.count} badge${parseInt(r.count) !== 1 ? "s" : ""}`,
    }));
  }
}
