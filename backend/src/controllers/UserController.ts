import type { Request, Response } from "express";
import { UserService } from "../services/UserService.js";
import { param } from "../utils/params.js";

const service = new UserService();

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await service.findById(req.user!.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { password: _, ...safe } = user;
    res.json(safe);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const user = await service.updateProfile(req.user!.id, req.body);
    const { password: _, ...safe } = user;
    res.json(safe);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const getUser = async (req: Request, res: Response) => {
  try {
    const user = await service.findById(param(req, "id"));
    if (!user) return res.status(404).json({ message: "User not found" });
    // Explicit whitelist, not a blacklist — a blacklist silently exposes
    // every new column added to User in the future (email, stripeCustomerId,
    // creatorPayoutAccountId, isFoundingCreator, OTP/reset timestamps, etc.
    // were all being returned here before this fix) unless someone
    // remembers to add it to the exclusion list too.
    const safe = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio,
      profilePictureUrl: user.profilePictureUrl,
      websiteUrl: user.websiteUrl,
      linkedinUrl: user.linkedinUrl,
    };
    res.json(safe);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
};

export const listUsers = async (req: Request, res: Response) => {
  try {
    const users = await service.findAll();
    res.json(users.map(({ password: _, ...u }) => u));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
};

export const setUserStatus = async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body;
    const user = await service.setActive(param(req, "id"), isActive);
    const { password: _, ...safe } = user;
    res.json(safe);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};
