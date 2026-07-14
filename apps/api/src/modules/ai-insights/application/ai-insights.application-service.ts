import { Inject, Injectable } from '@nestjs/common';

import { AiInsightsDomainService } from '../domain/ai-insights.domain-service.js';
import { AiInsightsPolicy } from '../policies/ai-insights.policy.js';
import type { AiInsightsRepository } from '../repositories/ai-insights.repository.js';
import { AI_INSIGHTS_REPOSITORY } from '../repositories/ai-insights.repository.js';

/**
 * Application-service placeholder for AI Insights.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class AiInsightsApplicationService {
  constructor(
    private readonly domainService: AiInsightsDomainService,
    private readonly policy: AiInsightsPolicy,
    @Inject(AI_INSIGHTS_REPOSITORY) private readonly repository: AiInsightsRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'AI Insights',
      ready: false,
    };
  }
}
