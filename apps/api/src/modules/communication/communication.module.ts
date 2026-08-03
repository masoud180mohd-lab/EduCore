import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { PlatformOperationsModule } from '../platform-operations/index.js';
import { CommunicationApplicationService } from './application/communication.application-service.js';
import { NotificationsService } from './application/notifications.service.js';
import { CommunicationController } from './controllers/communication.controller.js';
import { NotificationsProductController } from './controllers/notifications.product.controller.js';
import { CommunicationDomainService } from './domain/communication.domain-service.js';
import { CommunicationPolicy } from './policies/communication.policy.js';
import { FakeSmsProvider } from './providers/fake-sms.provider.js';
import { SMS_PROVIDER_PORT } from './providers/sms-provider.port.js';
import { COMMUNICATION_REPOSITORY } from './repositories/communication.repository.js';
import { CommunicationRepositoryPlaceholder } from './repositories/communication.repository.placeholder.js';
import { NotificationsRepository } from './repositories/notifications.repository.js';

/**
 * Bounded context: Communication (EPIC-COMMS-01).
 * SMS via SMS_PROVIDER_PORT — Fake default (COMMS-001 Beem when secrets later).
 */
@Module({
  imports: [DatabaseModule, PlatformOperationsModule],
  controllers: [CommunicationController, NotificationsProductController],
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
    FakeSmsProvider,
    {
      provide: SMS_PROVIDER_PORT,
      useExisting: FakeSmsProvider,
    },
  ],
  exports: [CommunicationApplicationService, COMMUNICATION_REPOSITORY, NotificationsService],
})
export class CommunicationModule {}
