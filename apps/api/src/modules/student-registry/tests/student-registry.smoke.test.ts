import { describe, expect, it } from 'vitest';

import { StudentRegistryApplicationService } from '../application/student-registry.application-service.js';
import { StudentRegistryDomainService } from '../domain/student-registry.domain-service.js';
import { StudentRegistryEventNames } from '../events/student-registry.events.js';
import { StudentRegistryModule } from '../student-registry.module.js';
import { StudentRegistryPolicy } from '../policies/student-registry.policy.js';

describe('Student Registry module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(StudentRegistryModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new StudentRegistryApplicationService(
      new StudentRegistryDomainService(),
      new StudentRegistryPolicy(),
      { boundedContext: 'Student Registry' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'Student Registry',
      ready: false,
    });
    expect(new StudentRegistryPolicy().isAllowed()).toBe(false);
    expect(StudentRegistryEventNames.skeletonRegistered).toBe(
      'student-registry.skeleton.registered',
    );
  });
});
