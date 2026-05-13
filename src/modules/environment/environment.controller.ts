import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EnvironmentService } from './environment.service';

@ApiTags('Environments')
@ApiBearerAuth()
@Controller()
export class EnvironmentController {
  constructor(private readonly environmentService: EnvironmentService) {}

  @Get('projects/:projectId/environments')
  @ApiOperation({
    summary: 'List fixed environments (dev, staging, production) for a project',
  })
  findByProject(@Param('projectId') projectId: string) {
    return this.environmentService.findByProject(projectId);
  }
}
