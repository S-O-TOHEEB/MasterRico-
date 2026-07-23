import type { Request, Response } from "express";
import { TrustService } from "../services/TrustService.js";
import { param } from "../utils/params.js";

const service = new TrustService();

export const followUser = async (req: Request, res: Response) => {
  try {
    const connection = await service.follow(req.user!.id, param(req, "userId"));
    res.status(201).json(connection);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const unfollowUser = async (req: Request, res: Response) => {
  try {
    await service.unfollow(req.user!.id, param(req, "userId"));
    res.status(204).send();
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const getFollowing = async (req: Request, res: Response) => {
  try {
    const users = await service.getFollowing(req.user!.id);
    res.json(users);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
};

export const getFollowers = async (req: Request, res: Response) => {
  try {
    const users = await service.getFollowers(req.user!.id);
    res.json(users);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
};
