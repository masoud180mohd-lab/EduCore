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

  await app.listen(config.port);

  logger.info('EduCore API skeleton listening', {
    service: config.serviceName,
    environment: config.environment,
    port: config.port,
  });
}

void bootstrap();
