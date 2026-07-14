import { Module } from '@nestjs/common';

import { AnalyticsApplicationService } from './application/analytics.application-service.js';
import { AnalyticsController } from './controllers/analytics.controller.js';
import { AnalyticsDomainService } from './domain/analytics.domain-service.js';
import { AnalyticsPolicy } from './policies/analytics.policy.js';
import { ANALYTICS_REPOSITORY } from './repositories/analytics.repository.js';
import { AnalyticsRepositoryPlaceholder } from './repositories/analytics.repository.placeholder.js';

/**
 * Bounded context skeleton: Analytics.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsApplicationService,
    AnalyticsDomainService,
    AnalyticsPolicy,
    {
      provide: ANALYTICS_REPOSITORY,
      useClass: AnalyticsRepositoryPlaceholder,
    },
  ],
  exports: [AnalyticsApplicationService, ANALYTICS_REPOSITORY],
})
export class AnalyticsModule {}
