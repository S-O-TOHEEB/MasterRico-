import { type Request, type Response } from "express";
import { ProfileService } from "../services/ProfileService.js";
import { param } from "../utils/params.js";

const profileService = new ProfileService();

export const ProfileController = {
  // GET /profile/me
  async getMe(req: Request, res: Response) {
    const user = await profileService.getProfile(req.user!.id);
    res.json({ success: true, data: user });
  },

  // PATCH /profile/me
  async updateMe(req: Request, res: Response) {
    const user = await profileService.updateProfile(req.user!.id, req.body);
    res.json({ success: true, data: user });
  },

  // GET /profile/creators/:id  (public)
  async getCreator(req: Request, res: Response) {
    const profile = await profileService.getCreatorProfile(param(req, "id"));
    res.json({ success: true, data: profile });
  },

  // POST /profile/follow/:userId
  async follow(req: Request, res: Response) {
    const connection = await profileService.follow(
      req.user!.id,
      param(req, "userId")
    );
    res.status(201).json({ success: true, data: connection });
  },

  // DELETE /profile/follow/:userId
  async unfollow(req: Request, res: Response) {
    await profileService.unfollow(req.user!.id, param(req, "userId"));
    res.json({ success: true, message: "Unfollowed" });
  },

  // GET /profile/following
  async listFollowing(req: Request, res: Response) {
    const users = await profileService.listFollowing(req.user!.id);
    res.json({ success: true, data: users });
  },

  // GET /profile/followers
  async listFollowers(req: Request, res: Response) {
    const users = await profileService.listFollowers(req.user!.id);
    res.json({ success: true, data: users });
  },
};
