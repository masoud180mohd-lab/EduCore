import { Inject, Injectable } from '@nestjs/common';

import { PaymentsDomainService } from '../domain/payments.domain-service.js';
import { PaymentsPolicy } from '../policies/payments.policy.js';
import type { PaymentsRepository } from '../repositories/payments.repository.js';
import { PAYMENTS_REPOSITORY } from '../repositories/payments.repository.js';

/**
 * Application-service placeholder for Payments.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class PaymentsApplicationService {
  constructor(
    private readonly domainService: PaymentsDomainService,
    private readonly policy: PaymentsPolicy,
    @Inject(PAYMENTS_REPOSITORY) private readonly repository: PaymentsRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'Payments',
      ready: false,
    };
  }
}
