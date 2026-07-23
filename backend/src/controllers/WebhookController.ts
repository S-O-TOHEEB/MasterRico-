import { type Request, type Response } from "express";
import { WebhookService } from "../services/WebhookService.js";
import logger from "../utils/logger.js";

const webhookService = new WebhookService();

export const WebhookController = {
  // POST /webhooks/stripe
  // Note: Express must expose rawBody for this route — see index.ts
  async stripe(req: Request, res: Response) {
    const signature = req.headers["stripe-signature"] as string;
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      res.status(400).json({ error: "Raw body unavailable" });
      return;
    }

    const isValid = webhookService.verifyStripeSignature(rawBody, signature);
    if (!isValid) {
      logger.warn("[WebhookController] Invalid Stripe signature");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    try {
      const event = JSON.parse(rawBody.toString());
      await webhookService.handleStripeEvent(event);
      res.json({ received: true });
    } catch (err) {
      logger.error("[WebhookController] Stripe event processing error", err);
      res.status(500).json({ error: "Processing failed" });
    }
  },

  // POST /webhooks/paystack
  async paystack(req: Request, res: Response) {
    const signature = req.headers["x-paystack-signature"] as string;
    if (!signature) {
      res.status(400).json({ error: "Missing x-paystack-signature header" });
      return;
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      res.status(400).json({ error: "Raw body unavailable" });
      return;
    }

    const isValid = webhookService.verifyPaystackSignature(rawBody, signature);
    if (!isValid) {
      logger.warn("[WebhookController] Invalid Paystack signature");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    try {
      const event = JSON.parse(rawBody.toString());
      await webhookService.handlePaystackEvent(event);
      res.json({ received: true });
    } catch (err) {
      logger.error("[WebhookController] Paystack event processing error", err);
      res.status(500).json({ error: "Processing failed" });
    }
  },

  // POST /webhooks/mux
  async mux(req: Request, res: Response) {
    const signature = req.headers["mux-signature"] as string;
    if (!signature) {
      res.status(400).json({ error: "Missing Mux-Signature header" });
      return;
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      res.status(400).json({ error: "Raw body unavailable" });
      return;
    }

    const isValid = webhookService.verifyMuxSignature(rawBody, signature);
    if (!isValid) {
      logger.warn("[WebhookController] Invalid Mux signature");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    try {
      const event = JSON.parse(rawBody.toString());
      await webhookService.handleMuxEvent(event);
      res.json({ received: true });
    } catch (err) {
      logger.error("[WebhookController] Mux event processing error", err);
      res.status(500).json({ error: "Processing failed" });
    }
  },
};
