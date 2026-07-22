import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { loadAppConfig } from './common/config/app-config.js';
import { ConsoleAppLogger } from './common/logging/logger.js';

async function bootstrap(): Promise<void> {
  const config = loadAppConfig();
  const logger = new ConsoleAppLogger();

  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  // Browser UI (@educore/web on :3001) calls the API on :3000. Without CORS,
  // fetch fails with a network error and the login page shows the offline stub.
  app.enableCors({
    origin: [
      'http://127.0.0.1:3001',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://localhost:3000',
    ],
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
      'X-Tenant-Id',
      'Idempotency-Key',
      'X-Request-Id',
      'X-Correlation-Id',
    ],
  });

  await app.listen(config.port);

  logger.info('EduCore API skeleton listening', {
    service: config.serviceName,
    environment: config.environment,
    port: config.port,
  });
}

void bootstrap();
