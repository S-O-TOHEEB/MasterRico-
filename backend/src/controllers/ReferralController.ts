import { type Request, type Response } from "express";
import { ReferralService } from "../services/ReferralService.js";

const referralService = new ReferralService();

export const ReferralController = {
  // GET /referrals/my-code
  async getMyCode(req: Request, res: Response) {
    const code = await referralService.getMyCode(req.user!.id);
    res.json({ success: true, data: code });
  },

  // GET /referrals/stats
  async getStats(req: Request, res: Response) {
    const stats = await referralService.getStats(req.user!.id);
    res.json({ success: true, data: stats });
  },

  // POST /referrals/apply  { code }  — called during or after registration
  async applyCode(req: Request, res: Response) {
    const { code } = req.body as { code?: string };
    if (!code) {
      res.status(400).json({ success: false, message: "code is required" });
      return;
    }
    await referralService.applyCode(code, req.user!.id);
    res.json({ success: true, message: "Referral code applied" });
  },
};
