import { Global, Module } from '@nestjs/common';

import { ConsoleAppLogger } from './logger.js';
import { APP_LOGGER } from './logger.tokens.js';

@Global()
@Module({
  providers: [
    {
      provide: APP_LOGGER,
      useClass: ConsoleAppLogger,
    },
  ],
  exports: [APP_LOGGER],
})
export class LoggerModule {}
