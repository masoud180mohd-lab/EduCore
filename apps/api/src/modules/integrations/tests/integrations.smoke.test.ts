import { describe, expect, it } from 'vitest';

import { IntegrationsApplicationService } from '../application/integrations.application-service.js';
import { IntegrationsDomainService } from '../domain/integrations.domain-service.js';
import { IntegrationsEventNames } from '../events/integrations.events.js';
import { IntegrationsModule } from '../integrations.module.js';
import { IntegrationsPolicy } from '../policies/integrations.policy.js';

describe('Integrations module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(IntegrationsModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new IntegrationsApplicationService(
      new IntegrationsDomainService(),
      new IntegrationsPolicy(),
      { boundedContext: 'Integrations' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'Integrations',
      ready: false,
    });
    expect(new IntegrationsPolicy().isAllowed()).toBe(false);
    expect(IntegrationsEventNames.skeletonRegistered).toBe('integrations.skeleton.registered');
  });
});
