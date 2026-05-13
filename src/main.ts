import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('EnvOps API')
    .setDescription(
      [
        'REST API for managing encrypted environment variables.',
        'Each project has fixed environments: `dev`, `staging`, `production`.',
        'Includes runtime env resolution for CLI injection.',
        '',
        '## CLI Install',
        '```bash',
        'npm install -g @envops/env-service',
        '```',
        '',
        '## First-Time Auth Flow',
        'On first use, CLI asks for `access token` and stores it in:',
        '`~/.env-service/config.json`',
        '',
        '## Main CLI Commands',
        '### Interactive CLI',
        '```bash',
        'env-service',
        '```',
        '',
        '### Setup Project + Environment + Token',
        '```bash',
        'env-service setup',
        'env-service setup --api-url http://localhost:3001 --project payments-service --environment staging --access-token <token>',
        '```',
        '',
        '### Run Command With Injected Runtime Env',
        '```bash',
        'env-service run npm start',
        'env-service run --project payments-service --env staging -- npm test',
        'env-service run --api-url http://localhost:3001 --project payments-service --env production -- node app.js',
        '```',
        '',
        '### Access Token Management',
        '```bash',
        '# create/update stored token',
        'env-service token set --access-token <new-token>',
        '',
        '# delete stored token',
        'env-service token delete',
        '',
        '# show masked token',
        'env-service token show',
        '```',
        '',
        '## Direct API CLI Commands (`envops`)',
        '```bash',
        '# token lifecycle',
        'envops token set --access-token <token>',
        'envops token delete',
        'envops token show',
        '',
        '# projects',
        'envops project create --name payments-service',
        'envops project list',
        'envops project get --id <projectId>',
        'envops project delete --id <projectId>',
        '',
        '# environments',
        'envops environment list --project-id <projectId>',
        '',
        '# env vars',
        'envops env create --project-id <projectId> --environment-id <environmentId> --key API_URL --value https://example.com',
        'envops env list --project-id <projectId> --environment-id <environmentId>',
        'envops env secure-list --project-id <projectId> --environment-id <environmentId> --client-id <clientId> --kid <kid>',
        'envops env update --id <envVarId> --value newValue',
        'envops env delete --id <envVarId>',
        'envops env register-client-key --project-id <projectId> --client-id <clientId> --kid <kid> --algorithm RSA-OAEP-256 --public-key "<pem>"',
        '```',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  const swaggerOptions = {
    swaggerOptions: {
      persistAuthorization: true,
    },
  };
  SwaggerModule.setup('api/docs', app, swaggerDocument, swaggerOptions);
  SwaggerModule.setup('docs', app, swaggerDocument, swaggerOptions);
  SwaggerModule.setup('swagger', app, swaggerDocument, swaggerOptions);

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
}

void bootstrap();
