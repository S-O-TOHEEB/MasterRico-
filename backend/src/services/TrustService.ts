import { AppDataSource } from "../config/database.js";
import { TrustConnection } from "../entities/TrustConnection.js";
import { User } from "../entities/User.js";

const trustRepo = () => AppDataSource.getRepository(TrustConnection);
const userRepo = () => AppDataSource.getRepository(User);

export class TrustService {
  async follow(followerId: string, followingId: string): Promise<TrustConnection> {
    if (followerId === followingId) throw new Error("You cannot follow yourself");
    const target = await userRepo().findOne({ where: { id: followingId } });
    if (!target) throw new Error("User not found");
    const existing = await trustRepo().findOne({ where: { followerId, followingId } });
    if (existing) return existing;
    const connection = trustRepo().create({ followerId, followingId });
    return trustRepo().save(connection);
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const connection = await trustRepo().findOne({ where: { followerId, followingId } });
    if (!connection) throw new Error("Not following this user");
    await trustRepo().remove(connection);
  }

  async getFollowing(followerId: string): Promise<User[]> {
    const connections = await trustRepo().find({
      where: { followerId },
      relations: ["following"],
    });
    return connections.map((c) => c.following);
  }

  async getFollowers(followingId: string): Promise<User[]> {
    const connections = await trustRepo().find({
      where: { followingId },
      relations: ["follower"],
    });
    return connections.map((c) => c.follower);
  }
}
