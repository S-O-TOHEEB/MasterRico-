import { type Request, type Response } from "express";
import { CorporateService } from "../services/CorporateService.js";
import { CorporatePlan } from "../entities/CorporateAccount.js";
import { CorporateMemberRole } from "../entities/CorporateMember.js";
import { param } from "../utils/params.js";

const corporateService = new CorporateService();

export const CorporateController = {
  // POST /corporate/accounts  { plan, companyName, currency? }
  async initiatePurchase(req: Request, res: Response) {
    const { plan, companyName, currency, customSeats } =
      req.body as {
        plan?: CorporatePlan; companyName?: string;
        currency?: string;    customSeats?: number;
      };
    if (!plan || !companyName) {
      res.status(400).json({ success: false, message: "plan and companyName are required" });
      return;
    }
    if (!Object.values(CorporatePlan).includes(plan)) {
      res.status(400).json({ success: false, message: "Valid plan: starter | business | enterprise" });
      return;
    }
    const result = await corporateService.initiatePurchase(
      req.user!.id, plan, companyName, req.user!.email, currency, customSeats,
    );
    res.status(201).json({ success: true, data: result });
  },

  // GET /corporate/accounts/mine
  async getMine(req: Request, res: Response) {
    const account = await corporateService.getAccountForAdmin(req.user!.id);
    res.json({ success: true, data: account });
  },

  // POST /corporate/accounts/:accountId/invite  { email, role? }
  async inviteMember(req: Request, res: Response) {
    const { email, role } = req.body as { email?: string; role?: CorporateMemberRole };
    if (!email) {
      res.status(400).json({ success: false, message: "email is required" });
      return;
    }
    const member = await corporateService.inviteMember(
      param(req, "accountId"), req.user!.id, email, role,
    );
    res.status(201).json({ success: true, data: member });
  },

  // POST /corporate/invite/accept  { token }
  async acceptInvite(req: Request, res: Response) {
    const { token } = req.body as { token?: string };
    if (!token) {
      res.status(400).json({ success: false, message: "token is required" });
      return;
    }
    const member = await corporateService.acceptInvite(token, req.user!.id);
    res.json({ success: true, data: member });
  },

  // GET /corporate/accounts/:accountId/members
  async listMembers(req: Request, res: Response) {
    const members = await corporateService.listMembers(
      param(req, "accountId"), req.user!.id,
    );
    res.json({ success: true, data: members });
  },

  // DELETE /corporate/accounts/:accountId/members/:memberId
  async removeMember(req: Request, res: Response) {
    await corporateService.removeMember(
      param(req, "accountId"), req.user!.id, param(req, "memberId"),
    );
    res.json({ success: true, message: "Member removed" });
  },

  // POST /corporate/accounts/:accountId/enroll  { courseId }
  async enrollTeam(req: Request, res: Response) {
    const { courseId } = req.body as { courseId?: string };
    if (!courseId) {
      res.status(400).json({ success: false, message: "courseId is required" });
      return;
    }
    const result = await corporateService.enrollTeam(
      param(req, "accountId"), req.user!.id, courseId,
    );
    res.json({ success: true, data: result });
  },

  // GET /corporate/accounts/:accountId/progress
  async teamProgress(req: Request, res: Response) {
    const data = await corporateService.getTeamProgress(
      param(req, "accountId"), req.user!.id,
    );
    res.json({ success: true, data });
  },
};
