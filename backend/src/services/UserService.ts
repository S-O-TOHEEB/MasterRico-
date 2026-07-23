import { AppDataSource } from "../config/database.js";
import { User } from "../entities/User.js";

const userRepo = () => AppDataSource.getRepository(User);

export class UserService {
  async findById(id: string): Promise<User | null> {
    return userRepo().findOne({ where: { id } });
  }

  async findAll(): Promise<User[]> {
    return userRepo().find({ order: { createdAt: "DESC" } });
  }

  async updateProfile(id: string, data: { firstName?: string; lastName?: string; bio?: string; profilePictureUrl?: string }): Promise<User> {
    const user = await userRepo().findOne({ where: { id } });
    if (!user) throw new Error("User not found");
    Object.assign(user, data);
    return userRepo().save(user);
  }

  async setActive(id: string, isActive: boolean): Promise<User> {
    const user = await userRepo().findOne({ where: { id } });
    if (!user) throw new Error("User not found");
    user.isActive = isActive;
    return userRepo().save(user);
  }
}
