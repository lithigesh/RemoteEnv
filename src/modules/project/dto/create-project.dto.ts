import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({
    example: 'payments-service',
    description: 'Unique project name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
