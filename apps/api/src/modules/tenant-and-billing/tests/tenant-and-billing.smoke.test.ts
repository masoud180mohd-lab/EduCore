import { describe, expect, it } from 'vitest';

import { TenantAndBillingApplicationService } from '../application/tenant-and-billing.application-service.js';
import { TenantAndBillingDomainService } from '../domain/tenant-and-billing.domain-service.js';
import { TenantAndBillingEventNames } from '../events/tenant-and-billing.events.js';
import { TenantAndBillingModule } from '../tenant-and-billing.module.js';
import { TenantAndBillingPolicy } from '../policies/tenant-and-billing.policy.js';

describe('Tenant And Billing module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(TenantAndBillingModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new TenantAndBillingApplicationService(
      new TenantAndBillingDomainService(),
      new TenantAndBillingPolicy(),
      { boundedContext: 'Tenant And Billing' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'Tenant And Billing',
      ready: false,
    });
    expect(new TenantAndBillingPolicy().isAllowed()).toBe(false);
    expect(TenantAndBillingEventNames.skeletonRegistered).toBe(
      'tenant-and-billing.skeleton.registered',
    );
  });
});
