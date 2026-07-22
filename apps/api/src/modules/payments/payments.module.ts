import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { PlatformOperationsModule } from '../platform-operations/index.js';
import { PaymentsApplicationService } from './application/payments.application-service.js';
import { PaymentsService } from './application/payments.service.js';
import { PaymentsController } from './controllers/payments.controller.js';
import { PaymentsProductController } from './controllers/payments.product.controller.js';
import { PaymentsWebhooksController } from './controllers/payments.webhooks.controller.js';
import { PaymentsDomainService } from './domain/payments.domain-service.js';
import { PaymentsPolicy } from './policies/payments.policy.js';
import { FakePaymentProvider } from './providers/fake-payment.provider.js';
import { PAYMENT_PROVIDER_PORT } from './providers/payment-provider.port.js';
import { PaymentAttemptsRepository } from './repositories/payment-attempts.repository.js';
import { PAYMENTS_REPOSITORY } from './repositories/payments.repository.js';
import { PaymentsRepositoryPlaceholder } from './repositories/payments.repository.placeholder.js';

/**
 * Bounded context: Payments.
 * Manual payments + receipts product surfaces (IMP-009 / ACF-012 / DBF-012).
 * The PLAT-003 skeleton (PaymentsController + PAYMENTS_REPOSITORY) is kept
 * intact for future gateway/webhook slices beyond manual payments.
 *
 * PAYMENT_PROVIDER_PORT resolves to FakePaymentProvider only (PAY-PROVIDER-001);
 * no real MoMo vendor is wired until a superseding brief supplies a sandbox
 * contract + signature verification spec.
 */
@Module({
  imports: [DatabaseModule, PlatformOperationsModule],
  controllers: [PaymentsController, PaymentsProductController, PaymentsWebhooksController],
  providers: [
    PaymentsApplicationService,
    PaymentsDomainService,
    PaymentsPolicy,
    {
      provide: PAYMENTS_REPOSITORY,
      useClass: PaymentsRepositoryPlaceholder,
    },
    PaymentAttemptsRepository,
    PaymentsService,
    FakePaymentProvider,
    {
      provide: PAYMENT_PROVIDER_PORT,
      useExisting: FakePaymentProvider,
    },
  ],
  exports: [PaymentsApplicationService, PAYMENTS_REPOSITORY, PaymentsService],
})
export class PaymentsModule {}
