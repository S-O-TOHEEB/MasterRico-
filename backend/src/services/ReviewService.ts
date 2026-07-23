import { AppDataSource } from "../config/database.js";
import { Review } from "../entities/Review.js";
import { Course } from "../entities/Course.js";
import { Enrollment, EnrollmentStatus } from "../entities/Enrollment.js";

interface CreateReviewDto {
  rating: number;   // 1–5
  comment?: string;
}

export class ReviewService {
  private reviewRepo = AppDataSource.getRepository(Review);
  private courseRepo = AppDataSource.getRepository(Course);
  private enrollmentRepo = AppDataSource.getRepository(Enrollment);

  async create(userId: string, courseId: string, dto: CreateReviewDto): Promise<Review> {
    if (dto.rating < 1 || dto.rating > 5) throw new Error("Rating must be between 1 and 5");

    const existing = await this.reviewRepo.findOneBy({ userId, courseId });
    if (existing) throw new Error("You have already reviewed this course");

    const enrollment = await this.enrollmentRepo.findOneBy({ userId, courseId });
    const isVerified =
      enrollment !== null &&
      (enrollment.status === EnrollmentStatus.ACTIVE ||
        enrollment.status === EnrollmentStatus.COMPLETED);

    const review = this.reviewRepo.create({
      userId,
      courseId,
      rating: dto.rating,
      comment: dto.comment,
      isVerifiedPurchase: isVerified,
    });
    const saved = await this.reviewRepo.save(review);

    // Recompute course stats
    await this.updateCourseStats(courseId);
    return saved;
  }

  async update(
    reviewId: string,
    userId: string,
    dto: Partial<CreateReviewDto>
  ): Promise<Review> {
    const review = await this.reviewRepo.findOneBy({ id: reviewId, userId });
    if (!review) throw new Error("Review not found or access denied");

    if (dto.rating !== undefined) {
      if (dto.rating < 1 || dto.rating > 5) throw new Error("Rating must be between 1 and 5");
      review.rating = dto.rating;
    }
    if (dto.comment !== undefined) review.comment = dto.comment;

    const saved = await this.reviewRepo.save(review);
    await this.updateCourseStats(review.courseId);
    return saved;
  }

  async delete(reviewId: string, userId: string): Promise<void> {
    const review = await this.reviewRepo.findOneBy({ id: reviewId, userId });
    if (!review) throw new Error("Review not found or access denied");
    await this.reviewRepo.remove(review);
    await this.updateCourseStats(review.courseId);
  }

  async markHelpful(reviewId: string): Promise<Review> {
    const review = await this.reviewRepo.findOneBy({ id: reviewId });
    if (!review) throw new Error("Review not found");
    review.helpfulCount++;
    return this.reviewRepo.save(review);
  }

  // ── Reporting + admin moderation queue ──────────────────────────────────────

  /** Flagging hides the review from listByCourse immediately, pending admin review. */
  async report(reviewId: string): Promise<void> {
    const review = await this.reviewRepo.findOneBy({ id: reviewId });
    if (!review) throw new Error("Review not found");
    review.isFlagged = true;
    await this.reviewRepo.save(review);
  }

  async listFlagged(page = 1, limit = 20): Promise<{ reviews: Review[]; total: number }> {
    const [reviews, total] = await this.reviewRepo.findAndCount({
      where: { isFlagged: true },
      relations: ["user", "course"],
      order: { updatedAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { reviews, total };
  }

  async unflag(reviewId: string): Promise<Review> {
    const review = await this.reviewRepo.findOneBy({ id: reviewId });
    if (!review) throw new Error("Review not found");
    review.isFlagged = false;
    return this.reviewRepo.save(review);
  }

  /** Admin hard-delete of a flagged review — bypasses the userId ownership check delete() enforces. */
  async adminDelete(reviewId: string): Promise<void> {
    const review = await this.reviewRepo.findOneBy({ id: reviewId });
    if (!review) throw new Error("Review not found");
    await this.reviewRepo.remove(review);
    await this.updateCourseStats(review.courseId);
  }

  async listByCourse(
    courseId: string,
    page = 1,
    limit = 20
  ): Promise<{ reviews: Review[]; total: number; averageRating: number }> {
    const [reviews, total] = await this.reviewRepo.findAndCount({
      where: { courseId, isFlagged: false },
      relations: ["user"],
      order: { helpfulCount: "DESC", createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const course = await this.courseRepo.findOneBy({ id: courseId });
    return { reviews, total, averageRating: Number(course?.averageRating ?? 0) };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async updateCourseStats(courseId: string): Promise<void> {
    const result = await this.reviewRepo
      .createQueryBuilder("review")
      .select("AVG(review.rating)", "avg")
      .addSelect("COUNT(review.id)", "count")
      .where("review.courseId = :courseId", { courseId })
      .getRawOne<{ avg: string; count: string }>();

    const avg = parseFloat(result?.avg ?? "0");
    const count = parseInt(result?.count ?? "0");

    // Quality score formula: weighted average + engagement bonus
    // 70% rating (normalised to 0–100), 30% verified-purchase ratio
    const verifiedCount = await this.reviewRepo.countBy({
      courseId,
      isVerifiedPurchase: true,
    });
    const verifiedRatio = count > 0 ? verifiedCount / count : 0;
    const qualityScore = Math.round(avg * 14 + verifiedRatio * 30);

    await this.courseRepo.update(courseId, {
      averageRating: parseFloat(avg.toFixed(2)),
      reviewCount: count,
      qualityScore: Math.min(qualityScore, 100),
    });
  }
}
