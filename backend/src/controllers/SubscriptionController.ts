import { type Request, type Response } from "express";
import { SubscriptionService } from "../services/SubscriptionService.js";
import {
  SubscriptionPlan,
  BillingPeriod,
} from "../entities/Subscription.js";

const subscriptionService = new SubscriptionService();

export const SubscriptionController = {
  // GET /subscriptions/current
  async getCurrent(req: Request, res: Response) {
    const subscription = await subscriptionService.getCurrent(req.user!.id);
    res.json({ success: true, data: subscription });
  },

  // POST /subscriptions  { plan, billingPeriod, currency? }
  async initiate(req: Request, res: Response) {
    const { plan, billingPeriod, currency } = req.body;

    if (!plan || !Object.values(SubscriptionPlan).includes(plan)) {
      res.status(400).json({ success: false, message: "Valid plan is required (creator_pro | learner_pro)" });
      return;
    }
    if (!billingPeriod || !Object.values(BillingPeriod).includes(billingPeriod)) {
      res.status(400).json({ success: false, message: "Valid billingPeriod required (monthly | annual)" });
      return;
    }

    const result = await subscriptionService.initiate(
      req.user!.id,
      plan as SubscriptionPlan,
      billingPeriod as BillingPeriod,
      req.user!.email,
      currency ?? "GBP"
    );
    res.status(201).json({ success: true, data: result });
  },

  // DELETE /subscriptions/current
  async cancel(req: Request, res: Response) {
    const subscription = await subscriptionService.cancel(req.user!.id);
    res.json({
      success: true,
      data: subscription,
      message: "Subscription will end at the current billing period",
    });
  },
};
