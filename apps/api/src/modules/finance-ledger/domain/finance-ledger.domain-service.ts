import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for Finance Ledger.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class FinanceLedgerDomainService {
  contextName(): string {
    return 'Finance Ledger';
  }
}
