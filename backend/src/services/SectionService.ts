import { AppDataSource } from "../config/database.js";
import { Section } from "../entities/Section.js";
import { Course } from "../entities/Course.js";

interface CreateSectionDto {
  title: string;
  orderIndex?: number;
}

export class SectionService {
  private sectionRepo = AppDataSource.getRepository(Section);
  private courseRepo  = AppDataSource.getRepository(Course);

  async create(courseId: string, creatorId: string, dto: CreateSectionDto): Promise<Section> {
    await this.assertOwnership(courseId, creatorId);

    const maxOrder = await this.sectionRepo
      .createQueryBuilder("s")
      .select("MAX(s.orderIndex)", "max")
      .where("s.courseId = :courseId", { courseId })
      .getRawOne<{ max: number | null }>();

    const section = this.sectionRepo.create({
      courseId,
      title: dto.title,
      orderIndex: dto.orderIndex ?? (maxOrder?.max ?? -1) + 1,
    });
    return this.sectionRepo.save(section);
  }

  async listByCourse(courseId: string): Promise<Section[]> {
    return this.sectionRepo.find({
      where: { courseId },
      relations: ["lessons"],
      order: { orderIndex: "ASC" },
    });
  }

  async update(
    sectionId: string, courseId: string, creatorId: string,
    dto: Partial<CreateSectionDto>
  ): Promise<Section> {
    await this.assertOwnership(courseId, creatorId);
    const section = await this.findOrFail(sectionId, courseId);
    Object.assign(section, dto);
    return this.sectionRepo.save(section);
  }

  async delete(sectionId: string, courseId: string, creatorId: string): Promise<void> {
    await this.assertOwnership(courseId, creatorId);
    const section = await this.findOrFail(sectionId, courseId);
    await this.sectionRepo.remove(section);
  }

  async reorder(courseId: string, creatorId: string, orderedIds: string[]): Promise<void> {
    await this.assertOwnership(courseId, creatorId);
    await Promise.all(
      orderedIds.map((id, index) =>
        this.sectionRepo.update({ id, courseId }, { orderIndex: index })
      )
    );
  }

  private async assertOwnership(courseId: string, creatorId: string): Promise<void> {
    const course = await this.courseRepo.findOneBy({ id: courseId, creatorId });
    if (!course) throw new Error("Course not found or access denied");
  }

  private async findOrFail(sectionId: string, courseId: string): Promise<Section> {
    const s = await this.sectionRepo.findOneBy({ id: sectionId, courseId });
    if (!s) throw new Error("Section not found");
    return s;
  }
}
