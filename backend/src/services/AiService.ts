import axios, { type AxiosInstance } from "axios";
import logger from "../utils/logger.js";

interface TagResponse {
  tags: string[];
}

interface SummarisationResponse {
  summary: string;
  keyPoints: string[];
  estimatedMinutes: number;
}

interface RecommendationRequest {
  userId: string;
  interests: string[];
  enrolledCourseIds: string[];
  limit?: number;
}

interface RecommendationResponse {
  recommendedCourseIds: string[];
  reasoning: string;
}

class AiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.AI_SERVICE_URL || "http://localhost:8000",
      timeout: 30_000,
      headers: {
        "X-Internal-Api-Key": process.env.AI_INTERNAL_API_KEY || "dev-key",
        "Content-Type": "application/json",
      },
    });
  }

  /** Auto-tag a course after it is published. Called from the BullMQ worker. */
  async generateCourseTags(title: string, description: string): Promise<string[]> {
    try {
      const res = await this.client.post<TagResponse>("/v1/tagging/course", {
        title,
        description,
      });
      return res.data.tags;
    } catch (err) {
      logger.error("[AiService] generateCourseTags failed", err);
      return [];
    }
  }

  /**
   * Summarise lesson content.
   * The AI service returns a short summary + bullet-point key takeaways
   * shown to learners before they watch.
   */
  async summariseLesson(
    title: string,
    description: string,
    transcript?: string
  ): Promise<SummarisationResponse | null> {
    try {
      const res = await this.client.post<SummarisationResponse>(
        "/v1/summarization/lesson",
        { title, description, transcript }
      );
      return res.data;
    } catch (err) {
      logger.error("[AiService] summariseLesson failed", err);
      return null;
    }
  }

  /** Personalised course recommendations for a learner. */
  async getRecommendations(
    req: RecommendationRequest
  ): Promise<RecommendationResponse> {
    try {
      const res = await this.client.post<RecommendationResponse>(
        "/v1/recommendations",
        req
      );
      return res.data;
    } catch (err) {
      logger.error("[AiService] getRecommendations failed", err);
      return { recommendedCourseIds: [], reasoning: "" };
    }
  }
}

// Singleton
export const aiService = new AiService();
