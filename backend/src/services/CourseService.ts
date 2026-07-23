import { AppDataSource } from "../config/database.js";
import { Course, CourseStatus, DifficultyLevel } from "../entities/Course.js";
import { User, SubscriptionTier } from "../entities/User.js";
import { Enrollment } from "../entities/Enrollment.js";
import { courseQueue } from "../utils/queue.js";
import logger from "../utils/logger.js";

interface CreateCourseDto {
  title: string;
  description: string;
  tagline?: string;
  pricePence?: number;
  currency?: string;
  difficultyLevel?: DifficultyLevel;
  learningOutcomes?: string[];
  prerequisites?: string[];
  language?: string;
}

interface UpdateCourseDto extends Partial<CreateCourseDto> {
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  resourceUrls?: string[];
  tags?: string[];
}

interface ListCoursesOptions {
  page?: number;
  limit?: number;
  status?: CourseStatus;
  creatorId?: string;
}

export class CourseService {
  private courseRepo = AppDataSource.getRepository(Course);
  private enrollmentRepo = AppDataSource.getRepository(Enrollment);

  async create(creatorId: string, dto: CreateCourseDto): Promise<Course> {
    // Enforce free-tier upload limit (5 courses max)
    const creator = await AppDataSource.getRepository(User).findOneBy({ id: creatorId });
    if (creator && creator.subscriptionTier === SubscriptionTier.FREE) {
      const existingCount = await this.courseRepo.countBy({ creatorId });
      if (existingCount >= 5) {
        throw new Error(
          "Free tier is limited to 5 courses. Upgrade to Creator Pro for unlimited uploads."
        );
      }
    }

    const course = this.courseRepo.create({
      creatorId,
      title: dto.title,
      description: dto.description,
      tagline: dto.tagline,
      pricePence: dto.pricePence ?? 0,
      currency: dto.currency ?? "GBP",
      difficultyLevel: dto.difficultyLevel,
      learningOutcomes: dto.learningOutcomes,
      prerequisites: dto.prerequisites,
      language: dto.language ?? "en",
      status: CourseStatus.DRAFT,
    });
    return this.courseRepo.save(course);
  }

  async update(
    courseId: string,
    creatorId: string,
    dto: UpdateCourseDto
  ): Promise<Course> {
    const course = await this.findOwnedOrFail(courseId, creatorId);
    Object.assign(course, dto);
    return this.courseRepo.save(course);
  }

  async publish(courseId: string, creatorId: string): Promise<Course> {
    const course = await this.findOwnedOrFail(courseId, creatorId);

    if (!course.title || !course.description) {
      throw new Error("A title and description are required before publishing");
    }

    course.status = CourseStatus.PUBLISHED;
    const saved = await this.courseRepo.save(course);

    // Fire-and-forget: auto-tag in background
    await courseQueue.add("tag-course", {
      courseId: saved.id,
      title: saved.title,
      description: saved.description,
    });

    logger.info(`[CourseService] Course ${courseId} published`);
    return saved;
  }

  async archive(courseId: string, creatorId: string): Promise<Course> {
    const course = await this.findOwnedOrFail(courseId, creatorId);
    course.status = CourseStatus.ARCHIVED;
    return this.courseRepo.save(course);
  }

  async delete(courseId: string, creatorId: string): Promise<void> {
    const course = await this.findOwnedOrFail(courseId, creatorId);
    if (course.status === CourseStatus.PUBLISHED) {
      throw new Error("Archive a course before deleting it");
    }
    await this.courseRepo.remove(course);
  }

  async findById(courseId: string): Promise<Course> {
    const course = await this.courseRepo.findOne({
      where: { id: courseId },
      relations: ["creator"],
    });
    if (!course) throw new Error("Course not found");
    return course;
  }

  async list(opts: ListCoursesOptions = {}): Promise<{ courses: Course[]; total: number }> {
    const { page = 1, limit = 20, status, creatorId } = opts;
    const qb = this.courseRepo
      .createQueryBuilder("course")
      .leftJoinAndSelect("course.creator", "creator")
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy("course.createdAt", "DESC");

    if (status) qb.andWhere("course.status = :status", { status });
    if (creatorId) qb.andWhere("course.creatorId = :creatorId", { creatorId });

    const [courses, total] = await qb.getManyAndCount();
    return { courses, total };
  }

  /** All courses for an authenticated creator (including drafts) */
  async listByCreator(creatorId: string): Promise<Course[]> {
    return this.courseRepo.find({
      where: { creatorId },
      order: { createdAt: "DESC" },
    });
  }

  /** Check if user is enrolled — used by lesson access guards */
  async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.enrollmentRepo.findOneBy({ userId, courseId });
    return enrollment !== null && enrollment.status === "active";
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private async findOwnedOrFail(courseId: string, creatorId: string): Promise<Course> {
    const course = await this.courseRepo.findOneBy({ id: courseId, creatorId });
    if (!course) throw new Error("Course not found or access denied");
    return course;
  }
}
