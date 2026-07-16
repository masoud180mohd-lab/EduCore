import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { TenantAndBillingApplicationService } from './application/tenant-and-billing.application-service.js';
import { TenantsService } from './application/tenants.service.js';
import { TenantAndBillingController } from './controllers/tenant-and-billing.controller.js';
import { TenantsController } from './controllers/tenants.controller.js';
import { TenantAndBillingDomainService } from './domain/tenant-and-billing.domain-service.js';
import { TenantAndBillingPolicy } from './policies/tenant-and-billing.policy.js';
import { AccessibleTenantsRepository } from './repositories/accessible-tenants.repository.js';
import { TENANT_AND_BILLING_REPOSITORY } from './repositories/tenant-and-billing.repository.js';
import { TenantAndBillingRepositoryPlaceholder } from './repositories/tenant-and-billing.repository.placeholder.js';

/**
 * Bounded context: Tenant And Billing.
 * First product route: GET /api/v1/tenants (membership-scoped read).
 * Write routes (create/update/delete) remain closed under ADR-012.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [TenantAndBillingController, TenantsController],
  providers: [
    TenantAndBillingApplicationService,
    TenantAndBillingDomainService,
    TenantAndBillingPolicy,
    {
      provide: TENANT_AND_BILLING_REPOSITORY,
      useClass: TenantAndBillingRepositoryPlaceholder,
    },
    AccessibleTenantsRepository,
    TenantsService,
  ],
  exports: [TenantAndBillingApplicationService, TENANT_AND_BILLING_REPOSITORY, TenantsService],
})
export class TenantAndBillingModule {}
