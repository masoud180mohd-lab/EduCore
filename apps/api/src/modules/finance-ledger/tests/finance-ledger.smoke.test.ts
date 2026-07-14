import { describe, expect, it } from 'vitest';

import { FinanceLedgerApplicationService } from '../application/finance-ledger.application-service.js';
import { FinanceLedgerDomainService } from '../domain/finance-ledger.domain-service.js';
import { FinanceLedgerEventNames } from '../events/finance-ledger.events.js';
import { FinanceLedgerModule } from '../finance-ledger.module.js';
import { FinanceLedgerPolicy } from '../policies/finance-ledger.policy.js';

describe('Finance Ledger module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(FinanceLedgerModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new FinanceLedgerApplicationService(
      new FinanceLedgerDomainService(),
      new FinanceLedgerPolicy(),
      { boundedContext: 'Finance Ledger' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'Finance Ledger',
      ready: false,
    });
    expect(new FinanceLedgerPolicy().isAllowed()).toBe(false);
    expect(FinanceLedgerEventNames.skeletonRegistered).toBe('finance-ledger.skeleton.registered');
  });
});
