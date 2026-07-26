import { AppDataSource } from "../config/database.js";
import { User } from "../entities/User.js";
import { pickFields } from "../utils/pickFields.js";

const userRepo = () => AppDataSource.getRepository(User);

const UPDATABLE_USER_FIELDS = ["firstName", "lastName", "bio", "profilePictureUrl"] as const;

export class UserService {
  async findById(id: string): Promise<User | null> {
    return userRepo().findOne({ where: { id } });
  }

  async findAll(): Promise<User[]> {
    return userRepo().find({ order: { createdAt: "DESC" } });
  }

  /**
   * Not currently reachable — userRoutes.ts doesn't mount a route for this
   * (ProfileController.updateMe / PATCH /profile/me is the live path for
   * self-service profile edits). Whitelisted anyway: an unreachable method
   * with the mass-assignment pattern is one route-file edit away from
   * becoming reachable again without anyone re-auditing it.
   */
  async updateProfile(id: string, data: { firstName?: string; lastName?: string; bio?: string; profilePictureUrl?: string }): Promise<User> {
    const user = await userRepo().findOne({ where: { id } });
    if (!user) throw new Error("User not found");
    Object.assign(user, pickFields(data, UPDATABLE_USER_FIELDS));
    return userRepo().save(user);
  }

  async setActive(id: string, isActive: boolean): Promise<User> {
    const user = await userRepo().findOne({ where: { id } });
    if (!user) throw new Error("User not found");
    user.isActive = isActive;
    return userRepo().save(user);
  }
}
