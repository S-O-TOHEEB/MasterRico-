import { AppDataSource } from "../config/database.js";
import { PortfolioProject } from "../entities/PortfolioProject.js";

export interface PortfolioProjectDto {
  title?: string;
  description?: string;
  projectUrl?: string;
  imageUrl?: string;
  orderIndex?: number;
}

export class PortfolioService {
  private repo = AppDataSource.getRepository(PortfolioProject);

  async listByCreator(creatorId: string): Promise<PortfolioProject[]> {
    return this.repo.find({
      where: { creatorId },
      order: { orderIndex: "ASC", createdAt: "ASC" },
    });
  }

  async create(creatorId: string, dto: PortfolioProjectDto): Promise<PortfolioProject> {
    if (!dto.title) throw new Error("title is required");
    const count = await this.repo.countBy({ creatorId });
    const project = this.repo.create({
      creatorId,
      title: dto.title,
      description: dto.description,
      projectUrl: dto.projectUrl,
      imageUrl: dto.imageUrl,
      orderIndex: dto.orderIndex ?? count,
    });
    return this.repo.save(project);
  }

  async update(creatorId: string, id: string, dto: PortfolioProjectDto): Promise<PortfolioProject> {
    const project = await this.findOwnedOrFail(id, creatorId);
    Object.assign(project, dto);
    return this.repo.save(project);
  }

  async remove(creatorId: string, id: string): Promise<void> {
    const project = await this.findOwnedOrFail(id, creatorId);
    await this.repo.remove(project);
  }

  async reorder(creatorId: string, orderedIds: string[]): Promise<PortfolioProject[]> {
    await Promise.all(
      orderedIds.map((id, index) => this.repo.update({ id, creatorId }, { orderIndex: index }))
    );
    return this.listByCreator(creatorId);
  }

  private async findOwnedOrFail(id: string, creatorId: string): Promise<PortfolioProject> {
    const project = await this.repo.findOneBy({ id, creatorId });
    if (!project) throw new Error("Portfolio project not found");
    return project;
  }
}
