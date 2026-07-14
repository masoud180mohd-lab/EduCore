import { describe, expect, it } from 'vitest';

import { PlatformOperationsApplicationService } from '../application/platform-operations.application-service.js';
import { PlatformOperationsDomainService } from '../domain/platform-operations.domain-service.js';
import { PlatformOperationsEventNames } from '../events/platform-operations.events.js';
import { PlatformOperationsModule } from '../platform-operations.module.js';
import { PlatformOperationsPolicy } from '../policies/platform-operations.policy.js';

describe('Platform Operations module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(PlatformOperationsModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new PlatformOperationsApplicationService(
      new PlatformOperationsDomainService(),
      new PlatformOperationsPolicy(),
      { boundedContext: 'Platform Operations' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'Platform Operations',
      ready: false,
    });
    expect(new PlatformOperationsPolicy().isAllowed()).toBe(false);
    expect(PlatformOperationsEventNames.skeletonRegistered).toBe(
      'platform-operations.skeleton.registered',
    );
  });
});
