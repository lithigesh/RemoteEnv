import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEnvironmentDto {
  @ApiProperty({
    example: 'staging',
    description: 'Environment name within a project',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;
}
