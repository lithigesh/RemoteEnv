import { PrismaClient } from '@prisma/client';
import { createCipheriv, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function encrypt(value: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

async function main() {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be set and contain exactly 32 characters');
  }

  const project = await prisma.project.upsert({
    where: { name: 'sample-project' },
    update: {},
    create: { name: 'sample-project' },
  });

  const devEnv = await prisma.environment.upsert({
    where: { projectId_name: { projectId: project.id, name: 'dev' } },
    update: {},
    create: {
      name: 'dev',
      projectId: project.id,
    },
  });

  await prisma.envVariable.upsert({
    where: {
      projectId_environmentId_key: {
        projectId: project.id,
        environmentId: devEnv.id,
        key: 'DATABASE_HOST',
      },
    },
    update: {},
    create: {
      key: 'DATABASE_HOST',
      value: encrypt('localhost', encryptionKey),
      projectId: project.id,
      environmentId: devEnv.id,
    },
  });

  await prisma.envVariable.upsert({
    where: {
      projectId_environmentId_key: {
        projectId: project.id,
        environmentId: devEnv.id,
        key: 'REDIS_URL',
      },
    },
    update: {},
    create: {
      key: 'REDIS_URL',
      value: encrypt('redis://127.0.0.1:6379', encryptionKey),
      projectId: project.id,
      environmentId: devEnv.id,
    },
  });

  await prisma.version.upsert({
    where: {
      projectId_environmentId_versionNumber: {
        projectId: project.id,
        environmentId: devEnv.id,
        versionNumber: 1,
      },
    },
    update: {},
    create: {
      projectId: project.id,
      environmentId: devEnv.id,
      versionNumber: 1,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
