import { Injectable } from '@nestjs/common';

import type { TenantAndBillingRepository } from './tenant-and-billing.repository.js';

/**
 * Non-persistent repository placeholder for Tenant And Billing.
 */
@Injectable()
export class TenantAndBillingRepositoryPlaceholder implements TenantAndBillingRepository {
  readonly boundedContext = 'Tenant And Billing' as const;
}
