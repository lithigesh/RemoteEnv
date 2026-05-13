import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueryRuntimeEnvDto } from './dto/query-runtime-env.dto';
import { EnvService } from './env.service';

@ApiTags('Runtime')
@ApiBearerAuth()
@Controller('runtime')
export class RuntimeController {
  constructor(private readonly envService: EnvService) {}

  @Get('env')
  @ApiOperation({
    summary: 'Resolve plaintext variables by project/environment names for runtime injection',
  })
  findRuntimeEnv(@Query() query: QueryRuntimeEnvDto) {
    return this.envService.findRuntimeEnvByNames(query);
  }
}
