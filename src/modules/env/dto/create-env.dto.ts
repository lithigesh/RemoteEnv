import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEnvDto {
  @ApiProperty({ example: 'JWT_SECRET', description: 'Environment variable key' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  key!: string;

  @ApiProperty({ example: 'super-secret-value', description: 'Plain secret value to encrypt' })
  @IsString()
  value!: string;

  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({ example: '22222222-2222-2222-2222-222222222222' })
  @IsUUID()
  environmentId!: string;
}
