import { AppDataSource } from "../config/database.js";
import { Course, CourseStatus } from "../entities/Course.js";
import { Enrollment, EnrollmentStatus } from "../entities/Enrollment.js";
import { Review } from "../entities/Review.js";
import { Notification, NotificationType } from "../entities/Notification.js";

export class CreatorAnalyticsService {
  private courseRepo     = AppDataSource.getRepository(Course);
  private enrollmentRepo = AppDataSource.getRepository(Enrollment);
  private reviewRepo     = AppDataSource.getRepository(Review);
  private notifRepo      = AppDataSource.getRepository(Notification);

  /** Top-level creator dashboard summary */
  async getOverview(creatorId: string) {
    const courses = await this.courseRepo.find({ where: { creatorId } });

    const publishedCourses = courses.filter(c => c.status === CourseStatus.PUBLISHED);
    const courseIds = courses.map(c => c.id);

    if (courseIds.length === 0) {
      return {
        totalCourses: 0, publishedCourses: 0, draftCourses: 0,
        totalStudents: 0, totalRevenuePence: 0, averageRating: 0,
        totalReviews: 0,
      };
    }

    // Total active enrollments across all creator courses
    const enrollmentStats = await this.enrollmentRepo
      .createQueryBuilder("e")
      .select("COUNT(DISTINCT e.userId)", "students")
      .addSelect("SUM(e.amountPaid)", "revenue")
      .where("e.courseId IN (:...courseIds)", { courseIds })
      .andWhere("e.status IN (:...statuses)", {
        statuses: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED],
      })
      .getRawOne<{ students: string; revenue: string }>();

    const reviewStats = await this.reviewRepo
      .createQueryBuilder("r")
      .select("AVG(r.rating)", "avg")
      .addSelect("COUNT(r.id)", "count")
      .where("r.courseId IN (:...courseIds)", { courseIds })
      .getRawOne<{ avg: string; count: string }>();

    return {
      totalCourses:      courses.length,
      publishedCourses:  publishedCourses.length,
      draftCourses:      courses.length - publishedCourses.length,
      totalStudents:     parseInt(enrollmentStats?.students ?? "0"),
      totalRevenuePence: parseInt(enrollmentStats?.revenue  ?? "0"),
      averageRating:     parseFloat(parseFloat(reviewStats?.avg ?? "0").toFixed(2)),
      totalReviews:      parseInt(reviewStats?.count ?? "0"),
    };
  }

  /** Per-course breakdown */
  async getCourseStats(courseId: string, creatorId: string) {
    const course = await this.courseRepo.findOneBy({ id: courseId, creatorId });
    if (!course) throw new Error("Course not found or access denied");

    const enrollments = await this.enrollmentRepo.find({
      where: { courseId, status: EnrollmentStatus.ACTIVE },
      relations: ["user"],
      order: { enrolledAt: "DESC" },
      take: 50,
    });

    const completedCount = await this.enrollmentRepo.countBy({
      courseId,
      status: EnrollmentStatus.COMPLETED,
    });

    const reviews = await this.reviewRepo.find({
      where: { courseId },
      relations: ["user"],
      order: { createdAt: "DESC" },
      take: 10,
    });

    return {
      course,
      enrollmentCount:  enrollments.length,
      completedCount,
      recentEnrollments: enrollments.map(e => ({
        userId:    e.userId,
        name:      `${e.user.firstName} ${e.user.lastName}`,
        progress:  e.progressPercent,
        enrolledAt: e.enrolledAt,
      })),
      recentReviews: reviews,
    };
  }

  /** Earnings breakdown: gross revenue minus platform commission */
  async getEarnings(creatorId: string) {
    const courses = await this.courseRepo.find({ where: { creatorId } });
    const courseIds = courses.map(c => c.id);
    if (courseIds.length === 0) return { summary: [], totalGross: 0, totalNet: 0 };

    const rows = await this.enrollmentRepo
      .createQueryBuilder("e")
      .select("e.courseId", "courseId")
      .addSelect("SUM(e.amountPaid)", "gross")
      .addSelect("SUM(e.amountPaid * (1 - e.commissionRate))", "net")
      .addSelect("COUNT(e.id)", "count")
      .where("e.courseId IN (:...courseIds)", { courseIds })
      .andWhere("e.status IN (:...statuses)", {
        statuses: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED],
      })
      .groupBy("e.courseId")
      .getRawMany<{ courseId: string; gross: string; net: string; count: string }>();

    const courseMap = new Map(courses.map(c => [c.id, c.title]));

    const summary = rows.map(r => ({
      courseId:    r.courseId,
      courseTitle: courseMap.get(r.courseId) ?? "Unknown",
      enrollments: parseInt(r.count),
      grossPence:  Math.round(parseFloat(r.gross)),
      netPence:    Math.round(parseFloat(r.net)),
    }));

    const totalGross = summary.reduce((s, r) => s + r.grossPence, 0);
    const totalNet   = summary.reduce((s, r) => s + r.netPence,   0);

    return { summary, totalGross, totalNet };
  }

  /** Full list of students enrolled across creator's courses */
  async getStudents(creatorId: string, page = 1, limit = 50) {
    const courses = await this.courseRepo.find({ where: { creatorId } });
    const courseIds = courses.map(c => c.id);
    if (courseIds.length === 0) return { students: [], total: 0 };

    const [enrollments, total] = await this.enrollmentRepo.findAndCount({
      where: { courseId: courseIds as any },
      relations: ["user", "course"],
      order: { enrolledAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const students = enrollments.map(e => ({
      userId:      e.userId,
      name:        `${e.user.firstName} ${e.user.lastName}`,
      email:       e.user.email,
      courseId:    e.courseId,
      courseTitle: e.course.title,
      progress:    e.progressPercent,
      status:      e.status,
      enrolledAt:  e.enrolledAt,
    }));

    return { students, total };
  }
}
