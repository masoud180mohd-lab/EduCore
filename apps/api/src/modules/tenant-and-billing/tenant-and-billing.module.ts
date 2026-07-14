import { Module } from '@nestjs/common';

import { TenantAndBillingApplicationService } from './application/tenant-and-billing.application-service.js';
import { TenantAndBillingController } from './controllers/tenant-and-billing.controller.js';
import { TenantAndBillingDomainService } from './domain/tenant-and-billing.domain-service.js';
import { TenantAndBillingPolicy } from './policies/tenant-and-billing.policy.js';
import { TENANT_AND_BILLING_REPOSITORY } from './repositories/tenant-and-billing.repository.js';
import { TenantAndBillingRepositoryPlaceholder } from './repositories/tenant-and-billing.repository.placeholder.js';

/**
 * Bounded context skeleton: Tenant And Billing.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [TenantAndBillingController],
  providers: [
    TenantAndBillingApplicationService,
    TenantAndBillingDomainService,
    TenantAndBillingPolicy,
    {
      provide: TENANT_AND_BILLING_REPOSITORY,
      useClass: TenantAndBillingRepositoryPlaceholder,
    },
  ],
  exports: [TenantAndBillingApplicationService, TENANT_AND_BILLING_REPOSITORY],
})
export class TenantAndBillingModule {}
