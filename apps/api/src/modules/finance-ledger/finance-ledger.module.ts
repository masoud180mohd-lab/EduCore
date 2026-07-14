import { Module } from '@nestjs/common';

import { FinanceLedgerApplicationService } from './application/finance-ledger.application-service.js';
import { FinanceLedgerController } from './controllers/finance-ledger.controller.js';
import { FinanceLedgerDomainService } from './domain/finance-ledger.domain-service.js';
import { FinanceLedgerPolicy } from './policies/finance-ledger.policy.js';
import { FINANCE_LEDGER_REPOSITORY } from './repositories/finance-ledger.repository.js';
import { FinanceLedgerRepositoryPlaceholder } from './repositories/finance-ledger.repository.placeholder.js';

/**
 * Bounded context skeleton: Finance Ledger.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [FinanceLedgerController],
  providers: [
    FinanceLedgerApplicationService,
    FinanceLedgerDomainService,
    FinanceLedgerPolicy,
    {
      provide: FINANCE_LEDGER_REPOSITORY,
      useClass: FinanceLedgerRepositoryPlaceholder,
    },
  ],
  exports: [FinanceLedgerApplicationService, FINANCE_LEDGER_REPOSITORY],
})
export class FinanceLedgerModule {}
