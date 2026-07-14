import { Module } from '@nestjs/common';

import { AiInsightsApplicationService } from './application/ai-insights.application-service.js';
import { AiInsightsController } from './controllers/ai-insights.controller.js';
import { AiInsightsDomainService } from './domain/ai-insights.domain-service.js';
import { AiInsightsPolicy } from './policies/ai-insights.policy.js';
import { AI_INSIGHTS_REPOSITORY } from './repositories/ai-insights.repository.js';
import { AiInsightsRepositoryPlaceholder } from './repositories/ai-insights.repository.placeholder.js';

/**
 * Bounded context skeleton: AI Insights.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [AiInsightsController],
  providers: [
    AiInsightsApplicationService,
    AiInsightsDomainService,
    AiInsightsPolicy,
    {
      provide: AI_INSIGHTS_REPOSITORY,
      useClass: AiInsightsRepositoryPlaceholder,
    },
  ],
  exports: [AiInsightsApplicationService, AI_INSIGHTS_REPOSITORY],
})
export class AiInsightsModule {}
