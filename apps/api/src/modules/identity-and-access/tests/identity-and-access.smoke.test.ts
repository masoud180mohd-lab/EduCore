import { describe, expect, it } from 'vitest';

import { IdentityAndAccessApplicationService } from '../application/identity-and-access.application-service.js';
import { IdentityAndAccessDomainService } from '../domain/identity-and-access.domain-service.js';
import { IdentityAndAccessEventNames } from '../events/identity-and-access.events.js';
import { IdentityAndAccessModule } from '../identity-and-access.module.js';
import { IdentityAndAccessPolicy } from '../policies/identity-and-access.policy.js';

describe('Identity And Access module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(IdentityAndAccessModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new IdentityAndAccessApplicationService(
      new IdentityAndAccessDomainService(),
      new IdentityAndAccessPolicy(),
      { boundedContext: 'Identity And Access' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'Identity And Access',
      ready: false,
    });
    expect(new IdentityAndAccessPolicy().isAllowed()).toBe(false);
    expect(IdentityAndAccessEventNames.skeletonRegistered).toBe(
      'identity-and-access.skeleton.registered',
    );
  });
});
