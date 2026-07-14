import { Inject, Injectable } from '@nestjs/common';

import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/config.tokens.js';

export type HealthStatus = {
  readonly status: 'ok';
  readonly service: string;
  readonly environment: string;
  readonly timestamp: string;
};

export type ReadinessStatus = {
  readonly status: 'ready';
  readonly service: string;
  readonly checks: {
    readonly configuration: 'ok';
  };
  readonly timestamp: string;
};

@Injectable()
export class HealthService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  getLiveness(): HealthStatus {
    return {
      status: 'ok',
      service: this.config.serviceName,
      environment: this.config.environment,
      timestamp: new Date().toISOString(),
    };
  }

  getReadiness(): ReadinessStatus {
    return {
      status: 'ready',
      service: this.config.serviceName,
      checks: {
        configuration: 'ok',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
