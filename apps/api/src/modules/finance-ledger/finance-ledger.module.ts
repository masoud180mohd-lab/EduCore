import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { PlatformOperationsModule } from '../platform-operations/index.js';
import { FeeStructuresService } from './application/fee-structures.service.js';
import { FinanceLedgerApplicationService } from './application/finance-ledger.application-service.js';
import { InvoicesService } from './application/invoices.service.js';
import { FeeStructuresController } from './controllers/fee-structures.controller.js';
import { FinanceLedgerController } from './controllers/finance-ledger.controller.js';
import { InvoicesController } from './controllers/invoices.controller.js';
import { FinanceLedgerDomainService } from './domain/finance-ledger.domain-service.js';
import { FinanceLedgerPolicy } from './policies/finance-ledger.policy.js';
import { FinanceRepository } from './repositories/finance.repository.js';
import { FINANCE_LEDGER_REPOSITORY } from './repositories/finance-ledger.repository.js';
import { FinanceLedgerRepositoryPlaceholder } from './repositories/finance-ledger.repository.placeholder.js';

/**
 * Bounded context: Finance Ledger.
 * Fee structures + invoices product surfaces (IMP-009 / ACF-012 / DBF-012).
 * The PLAT-003 skeleton (FinanceLedgerController + FINANCE_LEDGER_REPOSITORY) is
 * kept intact for future ledger reporting slices beyond fees/invoices.
 */
@Module({
  imports: [DatabaseModule, PlatformOperationsModule],
  controllers: [FinanceLedgerController, FeeStructuresController, InvoicesController],
  providers: [
    FinanceLedgerApplicationService,
    FinanceLedgerDomainService,
    FinanceLedgerPolicy,
    {
      provide: FINANCE_LEDGER_REPOSITORY,
      useClass: FinanceLedgerRepositoryPlaceholder,
    },
    FinanceRepository,
    FeeStructuresService,
    InvoicesService,
  ],
  exports: [
    FinanceLedgerApplicationService,
    FINANCE_LEDGER_REPOSITORY,
    FeeStructuresService,
    InvoicesService,
  ],
})
export class FinanceLedgerModule {}
