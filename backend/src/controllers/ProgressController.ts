import type { Request, Response } from "express";
import { ProgressService } from "../services/ProgressService.js";
import { param } from "../utils/params.js";

const service = new ProgressService();

export const updateProgress = async (req: Request, res: Response) => {
  try {
    const { lessonId, watchedSeconds, isCompleted } = req.body;
    const progress = await service.upsert(req.user!.id, lessonId, watchedSeconds ?? 0, isCompleted ?? false);
    res.json(progress);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const getCourseProgress = async (req: Request, res: Response) => {
  try {
    const result = await service.getCourseProgress(req.user!.id, param(req, "courseId"));
    res.json(result);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
};
