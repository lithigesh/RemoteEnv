import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEnvDto {
  @ApiPropertyOptional({ example: 'JWT_SECRET_ROTATED' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  key?: string;

  @ApiPropertyOptional({ example: 'new-secret-value' })
  @IsOptional()
  @IsString()
  value?: string;
}
