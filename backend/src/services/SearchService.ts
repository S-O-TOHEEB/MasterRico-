import { AppDataSource } from "../config/database.js";
import { Course, CourseStatus, DifficultyLevel } from "../entities/Course.js";
import { aiService } from "./AiService.js";

export interface SearchQuery {
  q?: string;
  level?: DifficultyLevel;
  minRating?: number;
  maxPrice?: number;   // pence
  tags?: string[];
  language?: string;
  page?: number;
  limit?: number;
}

export interface SearchResult {
  courses: (Course & { trustScore?: number })[];
  total: number;
  page: number;
  totalPages: number;
}

export class SearchService {
  private courseRepo = AppDataSource.getRepository(Course);

  /**
   * Primary search method.
   * Combines:
   *   • Text match on title / description / tags
   *   • Quality score (educational value)
   *   • Average learner rating
   *   • Trust graph bonus (for authenticated users)
   */
  async search(query: SearchQuery, userId?: string): Promise<SearchResult> {
    const {
      q,
      level,
      minRating,
      maxPrice,
      tags,
      language,
      page = 1,
      limit = 20,
    } = query;

    const qb = this.courseRepo
      .createQueryBuilder("course")
      .innerJoinAndSelect("course.creator", "creator")
      .where("course.status = :status", { status: CourseStatus.PUBLISHED });

    // Text search across title, description, tagline, and tags
    if (q) {
      const term = `%${q.toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(course.title) LIKE :term
          OR LOWER(course.description) LIKE :term
          OR LOWER(course.tagline) LIKE :term
          OR EXISTS (
            SELECT 1 FROM unnest(string_to_array(course.tags, ',')) t WHERE LOWER(t) LIKE :term
          ))`,
        { term }
      );
    }

    // Filters
    if (level) {
      qb.andWhere("course.difficultyLevel = :level", { level });
    }
    if (minRating !== undefined && minRating > 0) {
      qb.andWhere("course.averageRating >= :minRating", { minRating });
    }
    if (maxPrice !== undefined) {
      qb.andWhere("course.pricePence <= :maxPrice", { maxPrice });
    }
    if (language) {
      qb.andWhere("course.language = :language", { language });
    }
    if (tags && tags.length > 0) {
      // Course must contain at least one of the requested tags
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM unnest(string_to_array(course.tags, ',')) t
          WHERE t = ANY(:tags)
        )`,
        { tags }
      );
    }

    // Trust-graph weighting for authenticated users
    if (userId) {
      qb.leftJoin(
        "reviews",
        "tr",
        `tr."courseId" = course.id
         AND tr."userId" IN (
           SELECT tc."followingId"
           FROM trust_connections tc
           WHERE tc."followerId" = :userId
         )`,
        { userId }
      );
      qb.addSelect(
        `COALESCE(AVG(tr.rating), 0)`,
        "trust_avg"
      );

      // Composite score: 50% quality, 30% rating, 20% trust bonus
      qb.addSelect(
        `(course.qualityScore * 0.5
          + course.averageRating * 10 * 0.3
          + COALESCE(AVG(tr.rating), 0) * 10 * 0.2)`,
        "relevance_score"
      );
      qb.groupBy("course.id, creator.id");
      qb.orderBy("relevance_score", "DESC");
    } else {
      // Anonymous: quality + rating only
      qb.orderBy(
        `(course.qualityScore * 0.6 + course.averageRating * 10 * 0.4)`,
        "DESC"
      );
    }

    // Secondary sort for determinism
    qb.addOrderBy("course.enrollmentCount", "DESC");

    const total = await qb.getCount();

    qb.skip((page - 1) * limit).take(limit);
    const courses = await qb.getMany();

    return {
      courses,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * AI-powered personalised recommendations.
   * Falls back to popular courses if AI service is unavailable.
   */
  async getRecommendations(
    userId: string,
    interests: string[],
    enrolledCourseIds: string[],
    limit = 10
  ): Promise<Course[]> {
    const aiResult = await aiService.getRecommendations({
      userId,
      interests,
      enrolledCourseIds,
      limit,
    });

    if (aiResult.recommendedCourseIds.length > 0) {
      const recommended = await this.courseRepo
        .createQueryBuilder("course")
        .leftJoinAndSelect("course.creator", "creator")
        .whereInIds(aiResult.recommendedCourseIds)
        .andWhere("course.status = :status", { status: CourseStatus.PUBLISHED })
        .getMany();

      // Preserve AI ordering
      const orderMap = new Map(
        aiResult.recommendedCourseIds.map((id, i) => [id, i])
      );
      return recommended.sort(
        (a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99)
      );
    }

    // Fallback: top-quality published courses not already enrolled in
    return this.courseRepo
      .createQueryBuilder("course")
      .leftJoinAndSelect("course.creator", "creator")
      .where("course.status = :status", { status: CourseStatus.PUBLISHED })
      .andWhere(
        enrolledCourseIds.length > 0
          ? "course.id NOT IN (:...enrolledCourseIds)"
          : "1=1",
        { enrolledCourseIds }
      )
      .orderBy("course.qualityScore", "DESC")
      .addOrderBy("course.averageRating", "DESC")
      .take(limit)
      .getMany();
  }

  /** Trending: highest-enrolment courses in the last 30 days */
  async getTrending(limit = 10): Promise<Course[]> {
    return this.courseRepo
      .createQueryBuilder("course")
      .leftJoinAndSelect("course.creator", "creator")
      .where("course.status = :status", { status: CourseStatus.PUBLISHED })
      .orderBy("course.enrollmentCount", "DESC")
      .addOrderBy("course.averageRating", "DESC")
      .take(limit)
      .getMany();
  }
}
