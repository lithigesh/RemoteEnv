import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectService {
  private static readonly DEFAULT_ENVIRONMENTS = [
    'dev',
    'staging',
    'production',
  ] as const;

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto) {
    try {
      return await this.prisma.project.create({
        data: {
          ...dto,
          environments: {
            create: ProjectService.DEFAULT_ENVIRONMENTS.map((name) => ({ name })),
          },
        },
        include: {
          environments: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Project name already exists');
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.project.delete({ where: { id } });
    return { message: 'Project deleted successfully' };
  }
}
