import { describe, expect, it } from 'vitest';

import { AssessmentApplicationService } from '../application/assessment.application-service.js';
import { AssessmentDomainService } from '../domain/assessment.domain-service.js';
import { AssessmentEventNames } from '../events/assessment.events.js';
import { AssessmentModule } from '../assessment.module.js';
import { AssessmentPolicy } from '../policies/assessment.policy.js';

describe('Assessment module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(AssessmentModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new AssessmentApplicationService(
      new AssessmentDomainService(),
      new AssessmentPolicy(),
      { boundedContext: 'Assessment' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'Assessment',
      ready: false,
    });
    expect(new AssessmentPolicy().isAllowed()).toBe(false);
    expect(AssessmentEventNames.skeletonRegistered).toBe('assessment.skeleton.registered');
  });
});
