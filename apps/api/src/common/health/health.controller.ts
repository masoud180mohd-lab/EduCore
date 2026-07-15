import { Controller, Get, Header } from '@nestjs/common';

import type { HealthStatus, ReadinessStatus } from './health.service.js';
import { HealthService } from './health.service.js';
import { ENGINEERING_STATUS_HTML } from './engineering-status.page.js';

/**
 * Neutral platform endpoints only.
 * Business Identity/Tenant routes remain closed under ADR-012.
 */
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Engineering status board — read-only platform page (not product UI). */
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getEngineeringStatus(): string {
    return ENGINEERING_STATUS_HTML;
  }

  @Get('health')
  getHealth(): HealthStatus {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  getReady(): ReadinessStatus {
    return this.healthService.getReadiness();
  }
}
