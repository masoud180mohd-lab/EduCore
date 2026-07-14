import { describe, expect, it } from 'vitest';

import { PaymentsApplicationService } from '../application/payments.application-service.js';
import { PaymentsDomainService } from '../domain/payments.domain-service.js';
import { PaymentsEventNames } from '../events/payments.events.js';
import { PaymentsModule } from '../payments.module.js';
import { PaymentsPolicy } from '../policies/payments.policy.js';

describe('Payments module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(PaymentsModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new PaymentsApplicationService(
      new PaymentsDomainService(),
      new PaymentsPolicy(),
      { boundedContext: 'Payments' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'Payments',
      ready: false,
    });
    expect(new PaymentsPolicy().isAllowed()).toBe(false);
    expect(PaymentsEventNames.skeletonRegistered).toBe('payments.skeleton.registered');
  });
});
