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
import {
  loadClickPesaConfig,
  resolvePaymentProviderName,
} from './providers/clickpesa-config.js';
import { ClickPesaPaymentProvider } from './providers/clickpesa-payment.provider.js';
import { FakePaymentProvider } from './providers/fake-payment.provider.js';
import { PAYMENT_PROVIDER_PORT } from './providers/payment-provider.port.js';
import { PaymentAttemptsRepository } from './repositories/payment-attempts.repository.js';
import { PAYMENTS_REPOSITORY } from './repositories/payments.repository.js';
import { PaymentsRepositoryPlaceholder } from './repositories/payments.repository.placeholder.js';

/**
 * Bounded context: Payments.
 * Manual payments + receipts product surfaces (IMP-009 / ACF-012 / DBF-012).
 * PAYMENT_PROVIDER_PORT → Fake by default; ClickPesa when PAYMENT_PROVIDER=clickpesa
 * and ClickPesa secrets are present (PAY-001 / PAY-002 / PAY-003).
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
      provide: ClickPesaPaymentProvider,
      useFactory: (): ClickPesaPaymentProvider =>
        new ClickPesaPaymentProvider(loadClickPesaConfig()),
    },
    {
      provide: PAYMENT_PROVIDER_PORT,
      useFactory: (
        fake: FakePaymentProvider,
        clickpesa: ClickPesaPaymentProvider,
      ): FakePaymentProvider | ClickPesaPaymentProvider => {
        if (resolvePaymentProviderName() === 'clickpesa' && clickpesa.isConfigured()) {
          return clickpesa;
        }
        return fake;
      },
      inject: [FakePaymentProvider, ClickPesaPaymentProvider],
    },
  ],
  exports: [PaymentsApplicationService, PAYMENTS_REPOSITORY, PaymentsService],
})
export class PaymentsModule {}
