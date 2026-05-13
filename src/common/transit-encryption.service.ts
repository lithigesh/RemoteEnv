import { BadRequestException, Injectable } from '@nestjs/common';
import {
  createPublicKey,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  constants,
} from 'crypto';

@Injectable()
export class TransitEncryptionService {
  validateRsaPublicKey(publicKeyPem: string): void {
    try {
      const key = createPublicKey(publicKeyPem);
      if (key.asymmetricKeyType !== 'rsa') {
        throw new Error('Public key is not RSA');
      }
    } catch {
      throw new BadRequestException('Invalid RSA public key');
    }
  }

  encryptForClient(publicKeyPem: string, payload: string) {
    const dataKey = randomBytes(32);
    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', dataKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(payload, 'utf8')),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const encryptedKey = publicEncrypt(
      {
        key: publicKeyPem,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      dataKey,
    );

    return {
      algorithm: 'RSA-OAEP-256+AES-256-GCM',
      encryptedKey: encryptedKey.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  decryptForClient(privateKeyPem: string, envelope: {
    encryptedKey: string;
    iv: string;
    tag: string;
    ciphertext: string;
  }): string {
    const dataKey = privateDecrypt(
      {
        key: privateKeyPem,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(envelope.encryptedKey, 'base64'),
    );

    const decipher = createDecipheriv(
      'aes-256-gcm',
      dataKey,
      Buffer.from(envelope.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));

    const plain = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final(),
    ]);

    return plain.toString('utf8');
  }

  // Helper for backend clients during onboarding/testing.
  generateRsaKeyPair() {
    return generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
  }
}
