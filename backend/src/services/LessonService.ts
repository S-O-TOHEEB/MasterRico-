import { AppDataSource } from "../config/database.js";
import { Lesson, LessonType } from "../entities/Lesson.js";
import { LessonProgress } from "../entities/LessonProgress.js";
import { Course } from "../entities/Course.js";
import { EnrollmentService } from "./EnrollmentService.js";
import { aiService } from "./AiService.js";

interface CreateLessonDto {
  title: string;
  description?: string;
  type?: LessonType;
  videoUrl?: string;
  durationSeconds?: number;
  orderIndex?: number;
  isPreviewable?: boolean;
}

export class LessonService {
  private lessonRepo   = AppDataSource.getRepository(Lesson);
  private progressRepo = AppDataSource.getRepository(LessonProgress);
  private courseRepo   = AppDataSource.getRepository(Course);
  private enrollmentService = new EnrollmentService();

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

  async listBySection(courseId: string, sectionId: string): Promise<Lesson[]> {
    return this.lessonRepo.find({
      where: { courseId, sectionId },
      order: { orderIndex: "ASC" },
    });
  }

  async findById(lessonId: string): Promise<Lesson> {
    const lesson = await this.lessonRepo.findOneBy({ id: lessonId });
    if (!lesson) throw new Error("Lesson not found");
    return lesson;
  }

  async update(
    lessonId: string, courseId: string, creatorId: string,
    dto: Partial<CreateLessonDto>
  ): Promise<Lesson> {
    await this.assertOwnership(courseId, creatorId);
    const lesson = await this.findInCourse(lessonId, courseId);
    Object.assign(lesson, dto);
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
    await this.enrollmentService.syncProgress(userId, lesson.courseId);

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
