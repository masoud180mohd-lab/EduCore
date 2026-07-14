import { Module } from '@nestjs/common';

import { PaymentsApplicationService } from './application/payments.application-service.js';
import { PaymentsController } from './controllers/payments.controller.js';
import { PaymentsDomainService } from './domain/payments.domain-service.js';
import { PaymentsPolicy } from './policies/payments.policy.js';
import { PAYMENTS_REPOSITORY } from './repositories/payments.repository.js';
import { PaymentsRepositoryPlaceholder } from './repositories/payments.repository.placeholder.js';

/**
 * Bounded context skeleton: Payments.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsApplicationService,
    PaymentsDomainService,
    PaymentsPolicy,
    {
      provide: PAYMENTS_REPOSITORY,
      useClass: PaymentsRepositoryPlaceholder,
    },
  ],
  exports: [PaymentsApplicationService, PAYMENTS_REPOSITORY],
})
export class PaymentsModule {}
