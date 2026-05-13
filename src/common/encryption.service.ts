import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!rawKey || rawKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be a 32 character string');
    }
    this.key = Buffer.from(rawKey, 'utf8');
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(payload: string): string {
    try {
      const [ivHex, tagHex, encryptedHex] = payload.split(':');
      const decipher = createDecipheriv(
        this.algorithm,
        this.key,
        Buffer.from(ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, 'hex')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      throw new InternalServerErrorException('Failed to decrypt variable value');
    }
  }
}
