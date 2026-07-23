import { type Request, type Response } from "express";
import { CreatorPayoutService } from "../services/CreatorPayoutService.js";

const service = new CreatorPayoutService();

export const CreatorPayoutController = {
  // POST /creator/payout/connect
  async connect(req: Request, res: Response) {
    try {
      const data = await service.initiateConnect(req.user!.id, req.user!.email);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // POST /creator/payout/callback
  // Called when Stripe redirects the browser back to your return_url after
  // onboarding. Re-fetches the account from Stripe rather than trusting the
  // redirect itself — see CreatorPayoutService.completeConnect.
  async callback(req: Request, res: Response) {
    try {
      const data = await service.completeConnect(req.user!.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // GET /creator/payout/status
  async status(req: Request, res: Response) {
    try {
      const data = await service.status(req.user!.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
};
