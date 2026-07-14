import { Module } from '@nestjs/common';

import { CommunicationApplicationService } from './application/communication.application-service.js';
import { CommunicationController } from './controllers/communication.controller.js';
import { CommunicationDomainService } from './domain/communication.domain-service.js';
import { CommunicationPolicy } from './policies/communication.policy.js';
import { COMMUNICATION_REPOSITORY } from './repositories/communication.repository.js';
import { CommunicationRepositoryPlaceholder } from './repositories/communication.repository.placeholder.js';

/**
 * Bounded context skeleton: Communication.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [CommunicationController],
  providers: [
    CommunicationApplicationService,
    CommunicationDomainService,
    CommunicationPolicy,
    {
      provide: COMMUNICATION_REPOSITORY,
      useClass: CommunicationRepositoryPlaceholder,
    },
  ],
  exports: [CommunicationApplicationService, COMMUNICATION_REPOSITORY],
})
export class CommunicationModule {}
