import { Inject, Injectable } from '@nestjs/common';

import { FinanceLedgerDomainService } from '../domain/finance-ledger.domain-service.js';
import { FinanceLedgerPolicy } from '../policies/finance-ledger.policy.js';
import type { FinanceLedgerRepository } from '../repositories/finance-ledger.repository.js';
import { FINANCE_LEDGER_REPOSITORY } from '../repositories/finance-ledger.repository.js';

/**
 * Application-service placeholder for Finance Ledger.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class FinanceLedgerApplicationService {
  constructor(
    private readonly domainService: FinanceLedgerDomainService,
    private readonly policy: FinanceLedgerPolicy,
    @Inject(FINANCE_LEDGER_REPOSITORY) private readonly repository: FinanceLedgerRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'Finance Ledger',
      ready: false,
    };
  }
}
