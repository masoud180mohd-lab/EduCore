import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { PaymentsModule } from '../payments/index.js';
import { PlatformOperationsModule } from '../platform-operations/index.js';
import { StudentRegistryModule } from '../student-registry/index.js';
import { FeeStructuresService } from './application/fee-structures.service.js';
import { FinanceLedgerApplicationService } from './application/finance-ledger.application-service.js';
import { InvoicesService } from './application/invoices.service.js';
import { ParentFeesService } from './application/parent-fees.service.js';
import { FeeStructuresController } from './controllers/fee-structures.controller.js';
import { FinanceLedgerController } from './controllers/finance-ledger.controller.js';
import { InvoicesController } from './controllers/invoices.controller.js';
import { ParentFeesController } from './controllers/parent-fees.controller.js';
import { FinanceLedgerDomainService } from './domain/finance-ledger.domain-service.js';
import { FinanceLedgerPolicy } from './policies/finance-ledger.policy.js';
import { FinanceRepository } from './repositories/finance.repository.js';
import { FINANCE_LEDGER_REPOSITORY } from './repositories/finance-ledger.repository.js';
import { FinanceLedgerRepositoryPlaceholder } from './repositories/finance-ledger.repository.placeholder.js';

/**
 * Bounded context: Finance Ledger.
 * Fee structures + invoices + parent-scoped fee reads (ACF-013).
 */
@Module({
  imports: [DatabaseModule, PlatformOperationsModule, StudentRegistryModule, PaymentsModule],
  controllers: [
    FinanceLedgerController,
    FeeStructuresController,
    InvoicesController,
    ParentFeesController,
  ],
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
    ParentFeesService,
  ],
  exports: [
    FinanceLedgerApplicationService,
    FINANCE_LEDGER_REPOSITORY,
    FeeStructuresService,
    InvoicesService,
  ],
})
export class FinanceLedgerModule {}
