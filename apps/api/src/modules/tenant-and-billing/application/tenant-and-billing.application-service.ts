import { Inject, Injectable } from '@nestjs/common';

import { TenantAndBillingDomainService } from '../domain/tenant-and-billing.domain-service.js';
import { TenantAndBillingPolicy } from '../policies/tenant-and-billing.policy.js';
import type { TenantAndBillingRepository } from '../repositories/tenant-and-billing.repository.js';
import { TENANT_AND_BILLING_REPOSITORY } from '../repositories/tenant-and-billing.repository.js';

/**
 * Application-service placeholder for Tenant And Billing.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class TenantAndBillingApplicationService {
  constructor(
    private readonly domainService: TenantAndBillingDomainService,
    private readonly policy: TenantAndBillingPolicy,
    @Inject(TENANT_AND_BILLING_REPOSITORY) private readonly repository: TenantAndBillingRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'Tenant And Billing',
      ready: false,
    };
  }
}
