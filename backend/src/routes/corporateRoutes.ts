import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { CorporateController } from "../controllers/CorporateController.js";
import { authenticate } from "../middlewares/auth.js";

const router = createRouter();

router.use(authenticate);

// Account
router.post(  "/accounts",       CorporateController.initiatePurchase);
router.get(   "/accounts/mine",  CorporateController.getMine);

// Invite management
router.post(  "/invite/accept",                          CorporateController.acceptInvite);
router.post(  "/accounts/:accountId/invite",             CorporateController.inviteMember);
router.get(   "/accounts/:accountId/members",            CorporateController.listMembers);
router.delete("/accounts/:accountId/members/:memberId",  CorporateController.removeMember);

// Team learning
router.post("/accounts/:accountId/enroll",    CorporateController.enrollTeam);
router.get( "/accounts/:accountId/progress",  CorporateController.teamProgress);

export default router;
