import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { PlatformOperationsModule } from '../platform-operations/index.js';
import { CommunicationApplicationService } from './application/communication.application-service.js';
import { NotificationsService } from './application/notifications.service.js';
import { SmsOutboxWorker } from './application/outbox-worker.js';
import { CommunicationController } from './controllers/communication.controller.js';
import { NotificationsProductController } from './controllers/notifications.product.controller.js';
import { NotificationsWebhooksController } from './controllers/notifications.webhooks.controller.js';
import { CommunicationDomainService } from './domain/communication.domain-service.js';
import { CommunicationPolicy } from './policies/communication.policy.js';
import { loadBeemConfig, resolveSmsProviderName } from './providers/beem-config.js';
import { BeemSmsProvider } from './providers/beem-sms.provider.js';
import { FakeSmsProvider } from './providers/fake-sms.provider.js';
import { SMS_PROVIDER_PORT } from './providers/sms-provider.port.js';
import { COMMUNICATION_REPOSITORY } from './repositories/communication.repository.js';
import { CommunicationRepositoryPlaceholder } from './repositories/communication.repository.placeholder.js';
import { NotificationsRepository } from './repositories/notifications.repository.js';

/**
 * Bounded context: Communication (EPIC-COMMS-01).
 * SMS_PROVIDER_PORT → Fake by default; Beem when SMS_PROVIDER=beem and secrets present.
 */
@Module({
  imports: [DatabaseModule, PlatformOperationsModule],
  controllers: [
    CommunicationController,
    NotificationsProductController,
    NotificationsWebhooksController,
  ],
  providers: [
    CommunicationApplicationService,
    CommunicationDomainService,
    CommunicationPolicy,
    {
      provide: COMMUNICATION_REPOSITORY,
      useClass: CommunicationRepositoryPlaceholder,
    },
    NotificationsRepository,
    NotificationsService,
    SmsOutboxWorker,
    FakeSmsProvider,
    {
      provide: BeemSmsProvider,
      useFactory: (): BeemSmsProvider => new BeemSmsProvider(loadBeemConfig()),
    },
    {
      provide: SMS_PROVIDER_PORT,
      useFactory: (
        fake: FakeSmsProvider,
        beem: BeemSmsProvider,
      ): FakeSmsProvider | BeemSmsProvider => {
        if (resolveSmsProviderName() === 'beem' && beem.isConfigured()) {
          return beem;
        }
        return fake;
      },
      inject: [FakeSmsProvider, BeemSmsProvider],
    },
  ],
  exports: [CommunicationApplicationService, COMMUNICATION_REPOSITORY, NotificationsService],
})
export class CommunicationModule {}
