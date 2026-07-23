import { Router } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { LiveSessionController } from "../controllers/LiveSessionController.js";
import { authenticate, authorize } from "../middlewares/auth.js";

const router = createRouter();

// Public
router.get("/",           LiveSessionController.listUpcoming);
router.get("/:id",        LiveSessionController.getOne);

// Learner — RSVP
router.get( "/my/rsvps",  authenticate, LiveSessionController.myRsvps);
router.post("/:id/rsvp",  authenticate, LiveSessionController.rsvp);
router.delete("/:id/rsvp",authenticate, LiveSessionController.cancelRsvp);
router.get( "/:id/token", authenticate, LiveSessionController.getJoinToken);

// Creator — session management
router.post(  "/",                 authenticate, authorize("creator","admin"), LiveSessionController.create);
router.get(   "/my/sessions",      authenticate, authorize("creator","admin"), LiveSessionController.listMySessions);
router.patch( "/:id",              authenticate, authorize("creator","admin"), LiveSessionController.update);
router.post(  "/:id/go-live",      authenticate, authorize("creator","admin"), LiveSessionController.goLive);
router.post(  "/:id/end",          authenticate, authorize("creator","admin"), LiveSessionController.endSession);
router.post(  "/:id/cancel",       authenticate, authorize("creator","admin"), LiveSessionController.cancel);
router.get(   "/:id/rsvps",        authenticate, authorize("creator","admin"), LiveSessionController.listRsvps);

export default router;
