import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateEnvDto } from './dto/create-env.dto';
import { QueryEnvDto } from './dto/query-env.dto';
import { QuerySecureEnvDto } from './dto/query-secure-env.dto';
import { RegisterClientKeyDto } from './dto/register-client-key.dto';
import { UpdateEnvDto } from './dto/update-env.dto';
import { EnvService } from './env.service';

@ApiTags('Environment Variables')
@ApiBearerAuth()
@Controller('env')
export class EnvController {
  constructor(private readonly envService: EnvService) {}

  @Post()
  @ApiOperation({ summary: 'Add an environment variable' })
  create(@Body() dto: CreateEnvDto) {
    return this.envService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get variables by project and environment' })
  findAll(@Query() query: QueryEnvDto) {
    return this.envService.findAll(query);
  }

  @Post('clients/keys')
  @ApiOperation({ summary: 'Register or rotate a client public key' })
  registerClientKey(@Body() dto: RegisterClientKeyDto) {
    return this.envService.registerClientKey(dto);
  }

  @Get('secure')
  @ApiOperation({
    summary:
      'Get variables encrypted for a registered client key (no plaintext values in response)',
  })
  findAllEncrypted(@Query() query: QuerySecureEnvDto) {
    return this.envService.findAllEncrypted(query);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update variable by ID' })
  update(@Param('id') id: string, @Body() dto: UpdateEnvDto) {
    return this.envService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete variable by ID' })
  delete(@Param('id') id: string) {
    return this.envService.delete(id);
  }

  @Delete()
  @ApiOperation({
    summary:
      'Delete all variables for a project/environment (requires projectId + environmentId query)',
  })
  deleteAll(@Query() query: QueryEnvDto) {
    return this.envService.deleteAll(query);
  }
}
