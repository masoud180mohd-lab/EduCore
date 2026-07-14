import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for Tenant And Billing.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class TenantAndBillingDomainService {
  contextName(): string {
    return 'Tenant And Billing';
  }
}
