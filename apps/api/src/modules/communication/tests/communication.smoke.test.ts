import { describe, expect, it } from 'vitest';

import { CommunicationApplicationService } from '../application/communication.application-service.js';
import { CommunicationDomainService } from '../domain/communication.domain-service.js';
import { CommunicationEventNames } from '../events/communication.events.js';
import { CommunicationModule } from '../communication.module.js';
import { CommunicationPolicy } from '../policies/communication.policy.js';

describe('Communication module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(CommunicationModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new CommunicationApplicationService(
      new CommunicationDomainService(),
      new CommunicationPolicy(),
      { boundedContext: 'Communication' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'Communication',
      ready: false,
    });
    expect(new CommunicationPolicy().isAllowed()).toBe(false);
    expect(CommunicationEventNames.skeletonRegistered).toBe('communication.skeleton.registered');
  });
});
