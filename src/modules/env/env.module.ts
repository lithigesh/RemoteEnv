import { Module } from '@nestjs/common';
import { EncryptionService } from '../../common/encryption.service';
import { TransitEncryptionService } from '../../common/transit-encryption.service';
import { EnvController } from './env.controller';
import { EnvService } from './env.service';
import { RuntimeController } from './runtime.controller';

@Module({
  controllers: [EnvController, RuntimeController],
  providers: [EnvService, EncryptionService, TransitEncryptionService],
})
export class EnvModule {}
