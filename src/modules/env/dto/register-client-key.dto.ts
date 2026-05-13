import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class RegisterClientKeyDto {
  @ApiProperty({ example: '19ee1da8-8c5c-4f40-9d27-156edb9ccfea' })
  @IsUUID()
  projectId!: string;

  @ApiProperty({ example: 'fantasy-backend-service' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientId!: string;

  @ApiProperty({ example: 'v1-2026-04' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  kid!: string;

  @ApiProperty({ example: 'RSA-OAEP-256', enum: ['RSA-OAEP-256'] })
  @IsIn(['RSA-OAEP-256'])
  algorithm!: 'RSA-OAEP-256';

  @ApiProperty({
    example: '-----BEGIN PUBLIC KEY-----\\nMIIBIjANBgkq...\\n-----END PUBLIC KEY-----',
  })
  @IsString()
  @IsNotEmpty()
  publicKey!: string;
}
