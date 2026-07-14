import { describe, expect, it } from 'vitest';

import { AnalyticsApplicationService } from '../application/analytics.application-service.js';
import { AnalyticsDomainService } from '../domain/analytics.domain-service.js';
import { AnalyticsEventNames } from '../events/analytics.events.js';
import { AnalyticsModule } from '../analytics.module.js';
import { AnalyticsPolicy } from '../policies/analytics.policy.js';

describe('Analytics module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(AnalyticsModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new AnalyticsApplicationService(
      new AnalyticsDomainService(),
      new AnalyticsPolicy(),
      { boundedContext: 'Analytics' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'Analytics',
      ready: false,
    });
    expect(new AnalyticsPolicy().isAllowed()).toBe(false);
    expect(AnalyticsEventNames.skeletonRegistered).toBe('analytics.skeleton.registered');
  });
});
