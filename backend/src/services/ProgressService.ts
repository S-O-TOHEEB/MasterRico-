import { AppDataSource } from "../config/database.js";
import { LessonProgress } from "../entities/LessonProgress.js";
import { Lesson } from "../entities/Lesson.js";

const progressRepo = () => AppDataSource.getRepository(LessonProgress);
const lessonRepo = () => AppDataSource.getRepository(Lesson);

export class ProgressService {
  async upsert(userId: string, lessonId: string, watchedSeconds: number, isCompleted: boolean): Promise<LessonProgress> {
    let progress = await progressRepo().findOne({ where: { userId, lessonId } });
    if (progress) {
      progress.watchedSeconds = Math.max(progress.watchedSeconds, watchedSeconds);
      if (isCompleted && !progress.isCompleted) {
        progress.isCompleted = true;
        progress.completedAt = new Date();
      }
    } else {
      progress = progressRepo().create({
        userId,
        lessonId,
        watchedSeconds,
        isCompleted,
        completedAt: isCompleted ? new Date() : undefined,
      });
    }
    return progressRepo().save(progress);
  }

  async getCourseProgress(userId: string, courseId: string): Promise<{
    completedLessons: number;
    totalLessons: number;
    percentComplete: number;
    lessons: LessonProgress[];
  }> {
    const lessons = await lessonRepo().find({ where: { courseId } });
    const totalLessons = lessons.length;
    const lessonIds = lessons.map((l) => l.id);

    if (totalLessons === 0) {
      return { completedLessons: 0, totalLessons: 0, percentComplete: 0, lessons: [] };
    }

    const progressRecords = await progressRepo()
      .createQueryBuilder("p")
      .where("p.userId = :userId", { userId })
      .andWhere("p.lessonId IN (:...lessonIds)", { lessonIds })
      .getMany();

    const completedLessons = progressRecords.filter((p) => p.isCompleted).length;
    const percentComplete = Math.round((completedLessons / totalLessons) * 100);

    return { completedLessons, totalLessons, percentComplete, lessons: progressRecords };
  }
}
