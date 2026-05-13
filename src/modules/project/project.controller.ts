import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectService } from './project.service';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @ApiOperation({
    summary:
      'Create a new project (auto-creates fixed environments: dev, staging, production)',
  })
  create(@Body() dto: CreateProjectDto) {
    return this.projectService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all projects' })
  findAll() {
    return this.projectService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  findById(@Param('id') id: string) {
    return this.projectService.findById(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete project by ID' })
  delete(@Param('id') id: string) {
    return this.projectService.delete(id);
  }
}
