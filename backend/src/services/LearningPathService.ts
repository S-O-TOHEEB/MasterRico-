import { AppDataSource } from "../config/database.js";
import { LearningPath, LearningPathStatus } from "../entities/LearningPath.js";
import { Course, CourseStatus } from "../entities/Course.js";

interface CreateLearningPathDto {
  title: string;
  description: string;
  outcome?: string;
  thumbnailUrl?: string;
  courseIds?: string[];
  tags?: string[];
}

interface UpdateLearningPathDto extends Partial<CreateLearningPathDto> {
  estimatedDurationMinutes?: number;
}

export class LearningPathService {
  private pathRepo = AppDataSource.getRepository(LearningPath);
  private courseRepo = AppDataSource.getRepository(Course);

  async create(
    creatorId: string,
    dto: CreateLearningPathDto
  ): Promise<LearningPath> {
    if (dto.courseIds?.length) {
      await this.validateCourses(dto.courseIds);
    }

    const totalDuration = await this.computeTotalDuration(dto.courseIds ?? []);

    const path = this.pathRepo.create({
      creatorId,
      ...dto,
      estimatedDurationMinutes: totalDuration,
      status: LearningPathStatus.DRAFT,
    });
    return this.pathRepo.save(path);
  }

  async update(
    pathId: string,
    creatorId: string,
    dto: UpdateLearningPathDto
  ): Promise<LearningPath> {
    const path = await this.findOwnedOrFail(pathId, creatorId);

    if (dto.courseIds?.length) {
      await this.validateCourses(dto.courseIds);
      dto.estimatedDurationMinutes = await this.computeTotalDuration(dto.courseIds);
    }

    Object.assign(path, dto);
    return this.pathRepo.save(path);
  }

  async publish(pathId: string, creatorId: string): Promise<LearningPath> {
    const path = await this.findOwnedOrFail(pathId, creatorId);
    if (!path.courseIds?.length) {
      throw new Error("Add at least one course before publishing");
    }
    path.status = LearningPathStatus.PUBLISHED;
    return this.pathRepo.save(path);
  }

  async delete(pathId: string, creatorId: string): Promise<void> {
    const path = await this.findOwnedOrFail(pathId, creatorId);
    await this.pathRepo.remove(path);
  }

  async findById(pathId: string): Promise<LearningPath & { courses: Course[] }> {
    const path = await this.pathRepo.findOne({
      where: { id: pathId },
      relations: ["creator"],
    });
    if (!path) throw new Error("Learning path not found");

    const courses = await this.getCourses(path.courseIds ?? []);
    return { ...path, courses };
  }

  async list(
    page = 1,
    limit = 20
  ): Promise<{ paths: LearningPath[]; total: number }> {
    const [paths, total] = await this.pathRepo.findAndCount({
      where: { status: LearningPathStatus.PUBLISHED },
      relations: ["creator"],
      order: { enrollmentCount: "DESC", createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { paths, total };
  }

  async listByCreator(creatorId: string): Promise<LearningPath[]> {
    return this.pathRepo.find({
      where: { creatorId },
      order: { createdAt: "DESC" },
    });
  }

  /** Reorder courses within a path */
  async reorderCourses(
    pathId: string,
    creatorId: string,
    orderedCourseIds: string[]
  ): Promise<LearningPath> {
    const path = await this.findOwnedOrFail(pathId, creatorId);
    const existing = new Set(path.courseIds ?? []);
    for (const id of orderedCourseIds) {
      if (!existing.has(id)) throw new Error(`Course ${id} is not in this path`);
    }
    path.courseIds = orderedCourseIds;
    return this.pathRepo.save(path);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async findOwnedOrFail(
    pathId: string,
    creatorId: string
  ): Promise<LearningPath> {
    const path = await this.pathRepo.findOneBy({ id: pathId, creatorId });
    if (!path) throw new Error("Learning path not found or access denied");
    return path;
  }

  private async validateCourses(courseIds: string[]): Promise<void> {
    const courses = await this.courseRepo
      .createQueryBuilder("course")
      .whereInIds(courseIds)
      .andWhere("course.status = :status", { status: CourseStatus.PUBLISHED })
      .getMany();
    if (courses.length !== courseIds.length) {
      throw new Error("One or more courses are not published or do not exist");
    }
  }

  private async getCourses(courseIds: string[]): Promise<Course[]> {
    if (!courseIds.length) return [];
    const courses = await this.courseRepo
      .createQueryBuilder("course")
      .leftJoinAndSelect("course.creator", "creator")
      .whereInIds(courseIds)
      .getMany();
    const orderMap = new Map(courseIds.map((id, i) => [id, i]));
    return courses.sort(
      (a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99)
    );
  }

  private async computeTotalDuration(courseIds: string[]): Promise<number> {
    if (!courseIds.length) return 0;
    const result = await this.courseRepo
      .createQueryBuilder("course")
      .select("SUM(course.estimatedDurationMinutes)", "total")
      .whereInIds(courseIds)
      .getRawOne<{ total: string }>();
    return parseInt(result?.total ?? "0");
  }
}
