import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EnvironmentService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.environment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
