import { Queue, Worker, type Job } from "bullmq";
import { AppDataSource } from "../config/database.js";
import { Course } from "../entities/Course.js";
import { aiService } from "../services/AiService.js";
import logger from "./logger.js";

/**
 * Render injects REDIS_URL as a full connection string.
 * Local Docker Compose exposes REDIS_HOST + REDIS_PORT.
 * BullMQ (ioredis) accepts both formats.
 */
function getRedisConnection() {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL };
  }
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  };
}

const connection = getRedisConnection();

// ── Queues ────────────────────────────────────────────────────────────────────
export const courseQueue = new Queue("course-jobs", { connection });

// ── Job payloads ──────────────────────────────────────────────────────────────
export interface TagCourseJobData {
  courseId: string;
  title: string;
  description: string;
}

// ── Worker ────────────────────────────────────────────────────────────────────
let worker: Worker | null = null;

export function startWorkers() {
  worker = new Worker<TagCourseJobData>(
    "course-jobs",
    async (job: Job<TagCourseJobData>) => {
      if (job.name === "tag-course") {
        const { courseId, title, description } = job.data;
        logger.info(`[queue] Tagging course ${courseId}`);

        const tags = await aiService.generateCourseTags(title, description);
        if (tags.length === 0) return;

        await AppDataSource.getRepository(Course).update(courseId, { tags });
        logger.info(`[queue] Tagged course ${courseId}: ${tags.join(", ")}`);
      }
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    logger.error(`[queue] Job ${job?.id} failed`, err);
  });

  logger.info("[queue] Workers started");
}

export async function stopWorkers() {
  if (worker) await worker.close();
}
