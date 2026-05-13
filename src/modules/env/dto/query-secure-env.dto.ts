import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength } from 'class-validator';

export class QuerySecureEnvDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({ example: '22222222-2222-2222-2222-222222222222' })
  @IsUUID()
  environmentId!: string;

  @ApiProperty({ example: 'fantasy-backend-service' })
  @IsString()
  @MaxLength(100)
  clientId!: string;

  @ApiProperty({ example: 'v1-2026-04' })
  @IsString()
  @MaxLength(100)
  kid!: string;
}
