import { Router, type Request, type Response, type NextFunction } from "express";
import { createRouter } from "../utils/safeRouter.js";
import { WebhookController } from "../controllers/WebhookController.js";

const router = createRouter();

/**
 * Capture raw body before JSON parsing so HMAC signatures can be verified.
 * Must be applied per-route, before express.json().
 */
function captureRawBody(req: Request, res: Response, next: NextFunction) {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    (req as Request & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
    next();
  });
  req.on("error", next);
}

router.post("/stripe", captureRawBody, WebhookController.stripe);
router.post("/paystack", captureRawBody, WebhookController.paystack);
router.post("/mux", captureRawBody, WebhookController.mux);

export default router;
