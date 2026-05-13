import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption.service';
import { TransitEncryptionService } from '../../common/transit-encryption.service';
import { CreateEnvDto } from './dto/create-env.dto';
import { QueryEnvDto } from './dto/query-env.dto';
import { QueryRuntimeEnvDto } from './dto/query-runtime-env.dto';
import { QuerySecureEnvDto } from './dto/query-secure-env.dto';
import { RegisterClientKeyDto } from './dto/register-client-key.dto';
import { UpdateEnvDto } from './dto/update-env.dto';

@Injectable()
export class EnvService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly transitEncryptionService: TransitEncryptionService,
  ) {}

  private async assertEnvironmentBelongsToProject(
    projectId: string,
    environmentId: string,
  ) {
    const environment = await this.prisma.environment.findUnique({
      where: { id: environmentId },
    });

    if (!environment) {
      throw new NotFoundException('Environment not found');
    }

    if (environment.projectId !== projectId) {
      throw new BadRequestException('Environment does not belong to project');
    }
  }

  async create(dto: CreateEnvDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.assertEnvironmentBelongsToProject(dto.projectId, dto.environmentId);

    try {
      return await this.prisma.envVariable.create({
        data: {
          key: dto.key,
          value: this.encryptionService.encrypt(dto.value),
          projectId: dto.projectId,
          environmentId: dto.environmentId,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'Variable key already exists in this project and environment',
        );
      }
      throw error;
    }
  }

  async findAll(query: QueryEnvDto) {
    await this.assertEnvironmentBelongsToProject(
      query.projectId,
      query.environmentId,
    );

    const items = await this.prisma.envVariable.findMany({
      where: {
        projectId: query.projectId,
        environmentId: query.environmentId,
      },
      orderBy: { createdAt: 'asc' },
    });

    return items.map((item) => ({
      ...item,
      value: this.encryptionService.decrypt(item.value),
    }));
  }

  async findRuntimeEnvByNames(query: QueryRuntimeEnvDto) {
    const project = await this.prisma.project.findUnique({
      where: { name: query.project },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const environment = await this.prisma.environment.findUnique({
      where: {
        projectId_name: {
          projectId: project.id,
          name: query.environment,
        },
      },
    });

    if (!environment) {
      throw new NotFoundException('Environment not found for project');
    }

    const items = await this.prisma.envVariable.findMany({
      where: {
        projectId: project.id,
        environmentId: environment.id,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (items.length === 0) {
      throw new BadRequestException('No environment variables found');
    }

    const variables = items.reduce<Record<string, string>>((acc, item) => {
      acc[item.key] = this.encryptionService.decrypt(item.value);
      return acc;
    }, {});

    return {
      project: project.name,
      environment: environment.name,
      variables,
    };
  }

  async registerClientKey(dto: RegisterClientKeyDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    this.transitEncryptionService.validateRsaPublicKey(dto.publicKey);

    try {
      return await this.prisma.clientKey.upsert({
        where: {
          projectId_clientId_kid: {
            projectId: dto.projectId,
            clientId: dto.clientId,
            kid: dto.kid,
          },
        },
        update: {
          algorithm: dto.algorithm,
          publicKey: dto.publicKey,
          isActive: true,
        },
        create: {
          projectId: dto.projectId,
          clientId: dto.clientId,
          kid: dto.kid,
          algorithm: dto.algorithm,
          publicKey: dto.publicKey,
          isActive: true,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Client key already exists');
      }
      throw error;
    }
  }

  async findAllEncrypted(query: QuerySecureEnvDto) {
    await this.assertEnvironmentBelongsToProject(
      query.projectId,
      query.environmentId,
    );

    const clientKey = await this.prisma.clientKey.findUnique({
      where: {
        projectId_clientId_kid: {
          projectId: query.projectId,
          clientId: query.clientId,
          kid: query.kid,
        },
      },
    });

    if (!clientKey || !clientKey.isActive) {
      throw new NotFoundException('Active client key not found');
    }

    const items = await this.prisma.envVariable.findMany({
      where: {
        projectId: query.projectId,
        environmentId: query.environmentId,
      },
      orderBy: { createdAt: 'asc' },
    });

    const plaintextPayload = JSON.stringify({
      projectId: query.projectId,
      environmentId: query.environmentId,
      variables: items.map((item) => ({
        key: item.key,
        value: this.encryptionService.decrypt(item.value),
      })),
    });

    const encrypted = this.transitEncryptionService.encryptForClient(
      clientKey.publicKey,
      plaintextPayload,
    );

    return {
      clientId: query.clientId,
      kid: query.kid,
      ...encrypted,
    };
  }

  async update(id: string, dto: UpdateEnvDto) {
    const existing = await this.prisma.envVariable.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Variable not found');
    }

    const key = dto.key ?? existing.key;
    const value =
      dto.value !== undefined
        ? this.encryptionService.encrypt(dto.value)
        : existing.value;

    try {
      return await this.prisma.envVariable.update({
        where: { id },
        data: { key, value },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'Variable key already exists in this project and environment',
        );
      }
      throw error;
    }
  }

  async delete(id: string) {
    const existing = await this.prisma.envVariable.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Variable not found');
    }

    await this.prisma.envVariable.delete({ where: { id } });
    return { message: 'Variable deleted successfully' };
  }

  async deleteAll(query: QueryEnvDto) {
    await this.assertEnvironmentBelongsToProject(
      query.projectId,
      query.environmentId,
    );

    const result = await this.prisma.envVariable.deleteMany({
      where: {
        projectId: query.projectId,
        environmentId: query.environmentId,
      },
    });

    return {
      message: 'Variables deleted successfully',
      deletedCount: result.count,
    };
  }
}
