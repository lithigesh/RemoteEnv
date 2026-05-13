import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class QueryRuntimeEnvDto {
  @ApiProperty({ example: 'payments-service' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  project!: string;

  @ApiProperty({ example: 'staging' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  environment!: string;
}
