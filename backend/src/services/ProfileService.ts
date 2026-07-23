import { AppDataSource } from "../config/database.js";
import { User } from "../entities/User.js";
import { TrustConnection } from "../entities/TrustConnection.js";
import { Course, CourseStatus } from "../entities/Course.js";

interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  bio?: string;
  profilePictureUrl?: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  interests?: string[];
}

export class ProfileService {
  private userRepo = AppDataSource.getRepository(User);
  private trustRepo = AppDataSource.getRepository(TrustConnection);
  private courseRepo = AppDataSource.getRepository(Course);

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new Error("User not found");
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new Error("User not found");
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  /** Public creator profile — name, bio, and their published courses */
  async getCreatorProfile(creatorId: string) {
    const creator = await this.userRepo.findOneBy({ id: creatorId, isActive: true });
    if (!creator) throw new Error("Creator not found");

    const courses = await this.courseRepo.find({
      where: { creatorId, status: CourseStatus.PUBLISHED },
      order: { averageRating: "DESC", enrollmentCount: "DESC" },
      take: 20,
    });

    const followerCount = await this.trustRepo.countBy({ followingId: creatorId });

    return {
      id: creator.id,
      firstName: creator.firstName,
      lastName: creator.lastName,
      bio: creator.bio,
      profilePictureUrl: creator.profilePictureUrl,
      websiteUrl: creator.websiteUrl,
      linkedinUrl: creator.linkedinUrl,
      followerCount,
      courses,
    };
  }

  // ── Trust graph ─────────────────────────────────────────────────────────────

  async follow(followerId: string, followingId: string): Promise<TrustConnection> {
    if (followerId === followingId) throw new Error("Cannot follow yourself");

    const existing = await this.trustRepo.findOneBy({ followerId, followingId });
    if (existing) throw new Error("Already following");

    const following = await this.userRepo.findOneBy({ id: followingId });
    if (!following) throw new Error("User not found");

    const conn = this.trustRepo.create({ followerId, followingId });
    return this.trustRepo.save(conn);
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const conn = await this.trustRepo.findOneBy({ followerId, followingId });
    if (!conn) throw new Error("Not following");
    await this.trustRepo.remove(conn);
  }

  async listFollowing(userId: string): Promise<User[]> {
    const connections = await this.trustRepo.find({
      where: { followerId: userId },
      relations: ["following"],
    });
    return connections.map((c) => c.following);
  }

  async listFollowers(userId: string): Promise<User[]> {
    const connections = await this.trustRepo.find({
      where: { followingId: userId },
      relations: ["follower"],
    });
    return connections.map((c) => c.follower);
  }
}
