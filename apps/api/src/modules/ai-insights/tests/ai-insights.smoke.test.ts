import { describe, expect, it } from 'vitest';

import { AiInsightsApplicationService } from '../application/ai-insights.application-service.js';
import { AiInsightsDomainService } from '../domain/ai-insights.domain-service.js';
import { AiInsightsEventNames } from '../events/ai-insights.events.js';
import { AiInsightsModule } from '../ai-insights.module.js';
import { AiInsightsPolicy } from '../policies/ai-insights.policy.js';

describe('AI Insights module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(AiInsightsModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new AiInsightsApplicationService(
      new AiInsightsDomainService(),
      new AiInsightsPolicy(),
      { boundedContext: 'AI Insights' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'AI Insights',
      ready: false,
    });
    expect(new AiInsightsPolicy().isAllowed()).toBe(false);
    expect(AiInsightsEventNames.skeletonRegistered).toBe('ai-insights.skeleton.registered');
  });
});
