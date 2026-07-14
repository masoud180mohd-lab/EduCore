import { Injectable } from '@nestjs/common';

import type { FinanceLedgerRepository } from './finance-ledger.repository.js';

/**
 * Non-persistent repository placeholder for Finance Ledger.
 */
@Injectable()
export class FinanceLedgerRepositoryPlaceholder implements FinanceLedgerRepository {
  readonly boundedContext = 'Finance Ledger' as const;
}
