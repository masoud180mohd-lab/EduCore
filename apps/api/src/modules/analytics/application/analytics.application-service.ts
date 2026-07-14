import { Inject, Injectable } from '@nestjs/common';

import { AnalyticsDomainService } from '../domain/analytics.domain-service.js';
import { AnalyticsPolicy } from '../policies/analytics.policy.js';
import type { AnalyticsRepository } from '../repositories/analytics.repository.js';
import { ANALYTICS_REPOSITORY } from '../repositories/analytics.repository.js';

/**
 * Application-service placeholder for Analytics.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class AnalyticsApplicationService {
  constructor(
    private readonly domainService: AnalyticsDomainService,
    private readonly policy: AnalyticsPolicy,
    @Inject(ANALYTICS_REPOSITORY) private readonly repository: AnalyticsRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'Analytics',
      ready: false,
    };
  }
}
