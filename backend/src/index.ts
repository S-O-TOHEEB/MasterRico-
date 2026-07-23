import "reflect-metadata";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import dotenv from "dotenv";
import path from "path";

import { AppDataSource } from "./config/database.js";
import { validateEnv } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { startWorkers, stopWorkers } from "./utils/queue.js";
import logger from "./utils/logger.js";

// ── Routes ───────────────────────────────────────────────────────────────────
import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import enrollmentRoutes from "./routes/enrollmentRoutes.js";
import { courseReviewRouter, reviewRouter } from "./routes/reviewRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import certificateRoutes from "./routes/certificateRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import learningPathRoutes from "./routes/learningPathRoutes.js";
import sectionRoutes from "./routes/sectionRoutes.js";
import { lessonRouter, lessonProgressRouter } from "./routes/lessonRoutes.js";
import creatorRoutes from "./routes/creatorRoutes.js";
import { courseDiscussionRouter, discussionRouter } from "./routes/discussionRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import corporateRoutes    from "./routes/corporateRoutes.js";
import gamificationRoutes from "./routes/gamificationRoutes.js";
import referralRoutes     from "./routes/referralRoutes.js";
import liveSessionRoutes  from "./routes/liveSessionRoutes.js";
import { leaderboardRouter } from "./routes/leaderboardRoutes.js";
import adminRoutes         from "./routes/adminRoutes.js";

// ── Previously unwired routes (now active) ───────────────────────────────────
import userRoutes     from "./routes/userRoutes.js";
import mediaRoutes    from "./routes/mediaRoutes.js";
import paymentRoutes  from "./routes/paymentRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import trustRoutes    from "./routes/trustRoutes.js";

// ── New: frontend-gap batch (change/reset password, OTP, payment methods, ──
// ── portfolio, messaging — creator payout lives inside creatorRoutes.js) ──
import paymentMethodRoutes from "./routes/paymentMethodRoutes.js";
import portfolioRoutes     from "./routes/portfolioRoutes.js";
import messageRoutes       from "./routes/messageRoutes.js";

dotenv.config();
validateEnv();

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

// ── Security / Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(",") ?? "*",
    credentials: true,
  })
);

/**
 * Webhooks MUST receive raw body for HMAC signature verification.
 * Mount BEFORE the global express.json() parser.
 */
app.use("/api/v1/webhooks", webhookRoutes);

// Standard body parsers for all other routes
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serves files written by the local-storage fallback (STORAGE_PROVIDER=local).
// Harmless when using s3/cloudinary — the directory just stays empty.
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "edustream-backend",
    version: process.env.npm_package_version ?? "2.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ───────────────────────────────────────────────────────────────
const api = "/api/v1";

app.use(`${api}/auth`, authRoutes);
app.use(`${api}/courses`, courseRoutes);
app.use(`${api}/courses/:courseId/reviews`, courseReviewRouter);
app.use(`${api}/search`, searchRoutes);
app.use(`${api}/enrollments`, enrollmentRoutes);
app.use(`${api}/reviews`, reviewRouter);
app.use(`${api}/subscriptions`, subscriptionRoutes);
app.use(`${api}/certificates`, certificateRoutes);
app.use(`${api}/profile`, profileRoutes);
app.use(`${api}/learning-paths`, learningPathRoutes);

// ── Content structure (sections + lessons) ───────────────────────────────────
app.use(`${api}/courses/:courseId/sections`, sectionRoutes);
app.use(`${api}/courses/:courseId/sections/:sectionId/lessons`, lessonRouter);
app.use(`${api}/lessons`, lessonProgressRouter);

// ── Creator dashboard ─────────────────────────────────────────────────────────
app.use(`${api}/creator`, creatorRoutes);

// ── Community ─────────────────────────────────────────────────────────────────
app.use(`${api}/courses/:courseId/discussions`, courseDiscussionRouter);
app.use(`${api}/discussions`, discussionRouter);

// ── Notifications ─────────────────────────────────────────────────────────────
app.use(`${api}/notifications`, notificationRoutes);

// ── Corporate Training (Stream 4) ─────────────────────────────────────────────
app.use(`${api}/corporate`, corporateRoutes);

// ── Gamification (streaks + badges) ──────────────────────────────────────────
app.use(`${api}/gamification`, gamificationRoutes);

// ── Referral Programme ────────────────────────────────────────────────────────
app.use(`${api}/referrals`, referralRoutes);

// ── Live Sessions (Q&A + classes) ────────────────────────────────────────────
app.use(`${api}/live-sessions`, liveSessionRoutes);

// ── Leaderboard ───────────────────────────────────────────────────────────────
app.use(`${api}/leaderboard`, leaderboardRouter);

// ── Admin ──────────────────────────────────────────────────────────────────────
app.use(`${api}/admin`, adminRoutes);

// ── Users (public profiles + admin user management) ──────────────────────────
app.use(`${api}/users`, userRoutes);

// ── Media (presigned upload URLs + media record CRUD) ────────────────────────
app.use(`${api}/media`, mediaRoutes);

// ── Payments (initiation only — webhooks live at /api/v1/webhooks/*) ─────────
app.use(`${api}/payments`, paymentRoutes);

// ── Progress (lesson watch progress + per-course aggregate) ──────────────────
app.use(`${api}/progress`, progressRoutes);

// ── Trust graph (follow / unfollow social connections) ───────────────────────
app.use(`${api}/trust`, trustRoutes);

// ── New: payment methods, creator portfolio, direct messaging ────────────────
app.use(`${api}/payment-methods`, paymentMethodRoutes);
app.use(`${api}/portfolio`, portfolioRoutes);
app.use(`${api}/messages`, messageRoutes);

// ── Swagger Docs ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  const swaggerDoc = {
    openapi: "3.0.0",
    info: {
      title: "EduStream API",
      version: "2.0.0",
      description: "Video-first structured learning platform",
    },
    servers: [
      { url: `http://localhost:${PORT}`, description: "Local development" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/health": {
        get: { summary: "Health check", tags: ["System"], security: [] },
      },
      "/api/v1/auth/register": {
        post: {
          summary: "Register new user",
          tags: ["Auth"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                example: {
                  email: "user@example.com",
                  password: "Password1!",
                  firstName: "Jane",
                  lastName: "Doe",
                  role: "learner",
                },
              },
            },
          },
        },
      },
      "/api/v1/auth/login": {
        post: {
          summary: "Login",
          tags: ["Auth"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                example: { email: "user@example.com", password: "Password1!" },
              },
            },
          },
        },
      },
      "/api/v1/search": {
        get: {
          summary: "Search courses",
          tags: ["Search"],
          security: [],
          parameters: [
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "level", in: "query", schema: { type: "string", enum: ["beginner", "intermediate", "advanced"] } },
            { name: "minRating", in: "query", schema: { type: "number" } },
            { name: "maxPrice", in: "query", schema: { type: "number" } },
            { name: "tags", in: "query", schema: { type: "string" } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
        },
      },
      "/api/v1/search/trending": {
        get: { summary: "Trending courses", tags: ["Search"], security: [] },
      },
      "/api/v1/search/recommendations": {
        get: { summary: "Personalised recommendations", tags: ["Search"] },
      },
      "/api/v1/courses": {
        get: { summary: "List published courses", tags: ["Courses"], security: [] },
        post: { summary: "Create course (creator)", tags: ["Courses"] },
      },
      "/api/v1/courses/{id}": {
        get: { summary: "Get course", tags: ["Courses"], security: [] },
        patch: { summary: "Update course", tags: ["Courses"] },
        delete: { summary: "Delete draft course", tags: ["Courses"] },
      },
      "/api/v1/courses/{id}/publish": {
        post: { summary: "Publish course", tags: ["Courses"] },
      },
      "/api/v1/enrollments/my": {
        get: { summary: "My enrolled courses", tags: ["Enrollments"] },
      },
      "/api/v1/enrollments/free": {
        post: { summary: "Enrol in free course", tags: ["Enrollments"] },
      },
      "/api/v1/enrollments/pay": {
        post: { summary: "Initiate paid enrolment", tags: ["Enrollments"] },
      },
      "/api/v1/subscriptions/current": {
        get: { summary: "Current subscription", tags: ["Subscriptions"] },
        delete: { summary: "Cancel subscription", tags: ["Subscriptions"] },
      },
      "/api/v1/subscriptions": {
        post: { summary: "Subscribe to a plan", tags: ["Subscriptions"] },
      },
      "/api/v1/certificates/my": {
        get: { summary: "My certificates", tags: ["Certificates"] },
      },
      "/api/v1/certificates/verify/{code}": {
        get: { summary: "Verify certificate", tags: ["Certificates"], security: [] },
      },
      "/api/v1/profile/me": {
        get: { summary: "My profile", tags: ["Profile"] },
        patch: { summary: "Update profile", tags: ["Profile"] },
      },
      "/api/v1/learning-paths": {
        get: { summary: "List learning paths", tags: ["Learning Paths"], security: [] },
        post: { summary: "Create learning path", tags: ["Learning Paths"] },
      },
      "/api/v1/webhooks/stripe": {
        post: { summary: "Stripe webhook", tags: ["Webhooks"], security: [] },
      },
      "/api/v1/webhooks/paystack": {
        post: { summary: "Paystack webhook", tags: ["Webhooks"], security: [] },
      },
      // ── Newly wired routes ──────────────────────────────────────────────────
      "/api/v1/users": {
        get: { summary: "List all users (admin only)", tags: ["Users"] },
      },
      "/api/v1/users/{id}": {
        get: { summary: "Get public user profile", tags: ["Users"], security: [] },
      },
      "/api/v1/users/{id}/status": {
        patch: { summary: "Activate / deactivate user (admin only)", tags: ["Users"] },
      },
      "/api/v1/media/upload-url": {
        post: { summary: "Get upload target (S3 presigned URL / Cloudinary signed params / local endpoint)", tags: ["Media"] },
      },
      "/api/v1/media/local-upload": {
        post: { summary: "Direct multipart upload (STORAGE_PROVIDER=local only)", tags: ["Media"] },
      },
      "/api/v1/media/video/upload": {
        post: { summary: "Create a Mux direct-upload session for video", tags: ["Media"] },
      },
      "/api/v1/media/video/{uploadId}/status": {
        get: { summary: "Poll Mux transcode status + playback URL", tags: ["Media"] },
      },
      "/api/v1/media": {
        post: { summary: "Record uploaded media asset", tags: ["Media"] },
      },
      "/api/v1/media/my": {
        get: { summary: "My uploaded media", tags: ["Media"] },
      },
      "/api/v1/media/{id}": {
        get: { summary: "Get media asset by ID", tags: ["Media"] },
      },
      "/api/v1/payments/initialize": {
        post: { summary: "Initialise a payment (Stripe / Paystack)", tags: ["Payments"] },
      },
      "/api/v1/progress": {
        post: { summary: "Upsert lesson watch progress", tags: ["Progress"] },
      },
      "/api/v1/progress/{courseId}": {
        get: { summary: "Get aggregate course progress", tags: ["Progress"] },
      },
      "/api/v1/trust/following": {
        get: { summary: "List users I follow", tags: ["Trust"] },
      },
      "/api/v1/trust/followers": {
        get: { summary: "List my followers", tags: ["Trust"] },
      },
      "/api/v1/trust/follow/{userId}": {
        post: { summary: "Follow a user", tags: ["Trust"] },
        delete: { summary: "Unfollow a user", tags: ["Trust"] },
      },
    },
  };

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));
  logger.info(`[App] Swagger docs available at http://localhost:${PORT}/docs`);
}

// ── Error handling ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    await AppDataSource.initialize();
    logger.info("[Database] Connected to PostgreSQL");

    startWorkers();

    app.listen(PORT, "0.0.0.0", () => {
      logger.info(`[App] EduStream API running on port ${PORT}`);
      logger.info(`[App] Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (err) {
    logger.error("[App] Failed to start", err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("[App] SIGTERM received — shutting down");
  await stopWorkers();
  await AppDataSource.destroy();
  process.exit(0);
});

bootstrap();

export default app;
