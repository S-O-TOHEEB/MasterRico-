import { AppDataSource } from "../config/database.js";
import { Lesson, LessonType } from "../entities/Lesson.js";
import { LessonProgress } from "../entities/LessonProgress.js";
import { Course } from "../entities/Course.js";
import { EnrollmentService } from "./EnrollmentService.js";
import { aiService } from "./AiService.js";
import { WebhookService } from "./WebhookService.js";
import { pickFields } from "../utils/pickFields.js";

interface CreateLessonDto {
  title: string;
  description?: string;
  type?: LessonType;
  videoUrl?: string;
  durationSeconds?: number;
  orderIndex?: number;
  isPreviewable?: boolean;
}

const UPDATABLE_LESSON_FIELDS = [
  "title", "description", "type", "videoUrl", "durationSeconds", "orderIndex", "isPreviewable",
] as const;

export class LessonService {
  private lessonRepo   = AppDataSource.getRepository(Lesson);
  private progressRepo = AppDataSource.getRepository(LessonProgress);
  private courseRepo   = AppDataSource.getRepository(Course);
  private enrollmentService = new EnrollmentService();
  private webhookService = new WebhookService();

  async create(
    courseId: string, sectionId: string, creatorId: string,
    dto: CreateLessonDto
  ): Promise<Lesson> {
    await this.assertOwnership(courseId, creatorId);

    const maxOrder = await this.lessonRepo
      .createQueryBuilder("l")
      .select("MAX(l.orderIndex)", "max")
      .where("l.courseId = :courseId AND l.sectionId = :sectionId", { courseId, sectionId })
      .getRawOne<{ max: number | null }>();

    const lesson = this.lessonRepo.create({
      courseId,
      sectionId,
      title: dto.title,
      description: dto.description,
      type: dto.type ?? LessonType.VIDEO,
      videoUrl: dto.videoUrl,
      durationSeconds: dto.durationSeconds,
      orderIndex: dto.orderIndex ?? (maxOrder?.max ?? -1) + 1,
      isPreviewable: dto.isPreviewable ?? false,
    });
    return this.lessonRepo.save(lesson);
  }

  async listBySection(courseId: string, sectionId: string, requesterId?: string, requesterRole?: string): Promise<Lesson[]> {
    const lessons = await this.lessonRepo.find({
      where: { courseId, sectionId },
      order: { orderIndex: "ASC" },
    });

    const hasFullAccess = requesterId ? await this.hasGatedAccess(requesterId, courseId, requesterRole) : false;

    // Title/description/duration stay visible either way so people can
    // browse and decide whether to buy — only the actual playable URL is
    // gated. Without this, GET /courses/:id/sections/:id/lessons (a fully
    // public route with no auth at all) handed out the direct Mux/S3
    // playback URL for every lesson in every course, paid or not.
    return lessons.map((lesson) =>
      lesson.isPreviewable || hasFullAccess ? lesson : { ...lesson, videoUrl: undefined }
    );
  }

  async findById(lessonId: string, requesterId?: string, requesterRole?: string): Promise<Lesson> {
    const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
    if (!lesson) throw new Error("Lesson not found");

    const hasFullAccess = requesterId ? await this.hasGatedAccess(requesterId, lesson.courseId, requesterRole) : false;
    if (!lesson.isPreviewable && !hasFullAccess) {
      return { ...lesson, videoUrl: undefined };
    }
    return lesson;
  }

  async update(
    lessonId: string, courseId: string, creatorId: string,
    dto: Partial<CreateLessonDto>
  ): Promise<Lesson> {
    await this.assertOwnership(courseId, creatorId);
    const lesson = await this.findInCourse(lessonId, courseId);
    Object.assign(lesson, pickFields(dto, UPDATABLE_LESSON_FIELDS));
    return this.lessonRepo.save(lesson);
  }

  async delete(lessonId: string, courseId: string, creatorId: string): Promise<void> {
    await this.assertOwnership(courseId, creatorId);
    const lesson = await this.findInCourse(lessonId, courseId);
    await this.lessonRepo.remove(lesson);
  }

  async reorder(
    courseId: string, sectionId: string, creatorId: string,
    orderedIds: string[]
  ): Promise<void> {
    await this.assertOwnership(courseId, creatorId);
    await Promise.all(
      orderedIds.map((id, index) =>
        this.lessonRepo.update({ id, courseId, sectionId }, { orderIndex: index })
      )
    );
  }

  /** Learner marks a lesson complete — triggers progress sync */
  async markComplete(lessonId: string, userId: string): Promise<LessonProgress> {
    const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
    if (!lesson) throw new Error("Lesson not found");

    const hasAccess = await this.enrollmentService.hasAccess(userId, lesson.courseId);
    if (!hasAccess && !lesson.isPreviewable) {
      throw new Error("Not enrolled in this course");
    }

    let progress = await this.progressRepo.findOneBy({ userId, lessonId });
    if (!progress) {
      progress = this.progressRepo.create({ userId, lessonId, isCompleted: false });
    }
    if (progress.isCompleted) return progress; // idempotent

    progress.isCompleted = true;
    progress.completedAt = new Date();
    const saved = await this.progressRepo.save(progress);

    // Sync overall course progress — may auto-complete enrollment
    const { justCompleted } = await this.enrollmentService.syncProgress(userId, lesson.courseId);
    if (justCompleted) {
      // Best-effort, non-blocking — see WebhookService.onCourseCompletion.
      // This was previously never called from anywhere: completion never
      // auto-issued a certificate despite the method existing for exactly
      // this purpose.
      await this.webhookService.onCourseCompletion(userId, lesson.courseId);
    }

    return saved;
  }

  async getProgress(lessonId: string, userId: string): Promise<LessonProgress | null> {
    return this.progressRepo.findOneBy({ userId, lessonId });
  }

  /** AI-generated summary + key takeaways, shown before a learner watches. */
  async getSummary(lessonId: string, userId: string) {
    const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
    if (!lesson) throw new Error("Lesson not found");

    const hasAccess = await this.enrollmentService.hasAccess(userId, lesson.courseId);
    if (!hasAccess && !lesson.isPreviewable) {
      throw new Error("Not enrolled in this course");
    }

    const summary = await aiService.summariseLesson(lesson.title, lesson.description ?? "");
    if (!summary) throw new Error("Summary is not available right now — try again shortly");
    return summary;
  }

  // ── Private ──────────────────────────────────────────────────────────────────
  private async hasGatedAccess(userId: string, courseId: string, role?: string): Promise<boolean> {
    if (role === "admin") return true;
    const hasEnrollment = await this.enrollmentService.hasAccess(userId, courseId);
    if (hasEnrollment) return true;
    const course = await this.courseRepo.findOneBy({ id: courseId });
    return course?.creatorId === userId;
  }

  private async assertOwnership(courseId: string, creatorId: string): Promise<void> {
    const course = await this.courseRepo.findOneBy({ id: courseId, creatorId });
    if (!course) throw new Error("Course not found or access denied");
  }

  private async findInCourse(lessonId: string, courseId: string): Promise<Lesson> {
    const lesson = await this.lessonRepo.findOneBy({ id: lessonId, courseId });
    if (!lesson) throw new Error("Lesson not found");
    return lesson;
  }
}
