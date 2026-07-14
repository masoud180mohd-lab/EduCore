import { Controller, Get } from '@nestjs/common';

import type { HealthStatus, ReadinessStatus } from './health.service.js';
import { HealthService } from './health.service.js';

/**
 * Neutral platform health endpoints only.
 * Business routes are blocked until the applicable API Contract Freeze.
 */
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  getHealth(): HealthStatus {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  getReady(): ReadinessStatus {
    return this.healthService.getReadiness();
  }
}
