import { type Request, type Response } from "express";
import { SearchService } from "../services/SearchService.js";
import { EnrollmentService } from "../services/EnrollmentService.js";
import { DifficultyLevel } from "../entities/Course.js";

const searchService = new SearchService();
const enrollmentService = new EnrollmentService();

export const SearchController = {
  // GET /search?q=&level=&minRating=&maxPrice=&tags=&page=&limit=
  async search(req: Request, res: Response) {
    try {
      const {
        q,
        level,
        minRating,
        maxPrice,
        tags,
        language,
        page,
        limit,
      } = req.query;

      const results = await searchService.search(
        {
          q: q as string,
          level: level as DifficultyLevel,
          minRating: minRating ? parseFloat(minRating as string) : undefined,
          maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
          tags: tags ? (tags as string).split(",") : undefined,
          language: language as string,
          page: page ? parseInt(page as string) : 1,
          limit: limit ? Math.min(parseInt(limit as string), 100) : 20,
        },
        req.user?.id
      );

      res.json({ success: true, ...results });
    } catch (error: any) {
      // This endpoint previously had no error handling at all — a query-level
      // failure (e.g. a bad SQL fragment) became an unhandled promise
      // rejection, which can crash the whole process on Node 18+/20+ rather
      // than return a clean error response. See the SearchService fix in
      // this same change for the underlying bug that made that a real risk.
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /search/trending
  async trending(req: Request, res: Response) {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const courses = await searchService.getTrending(limit);
      res.json({ success: true, data: courses });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET /search/recommendations  (requires auth)
  async recommendations(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const enrollments = await enrollmentService.listByUser(userId);
      const enrolledCourseIds = enrollments.map((e) => e.courseId);
      const interests = req.user!.interests ?? [];

      const courses = await searchService.getRecommendations(
        userId,
        interests,
        enrolledCourseIds,
        10
      );
      res.json({ success: true, data: courses });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
