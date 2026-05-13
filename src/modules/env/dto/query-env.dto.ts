import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryEnvDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({ example: '22222222-2222-2222-2222-222222222222' })
  @IsUUID()
  environmentId!: string;
}
