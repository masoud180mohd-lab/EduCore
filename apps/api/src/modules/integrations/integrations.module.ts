import { Module } from '@nestjs/common';

import { IntegrationsApplicationService } from './application/integrations.application-service.js';
import { IntegrationsController } from './controllers/integrations.controller.js';
import { IntegrationsDomainService } from './domain/integrations.domain-service.js';
import { IntegrationsPolicy } from './policies/integrations.policy.js';
import { INTEGRATIONS_REPOSITORY } from './repositories/integrations.repository.js';
import { IntegrationsRepositoryPlaceholder } from './repositories/integrations.repository.placeholder.js';

/**
 * Bounded context skeleton: Integrations.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [IntegrationsController],
  providers: [
    IntegrationsApplicationService,
    IntegrationsDomainService,
    IntegrationsPolicy,
    {
      provide: INTEGRATIONS_REPOSITORY,
      useClass: IntegrationsRepositoryPlaceholder,
    },
  ],
  exports: [IntegrationsApplicationService, INTEGRATIONS_REPOSITORY],
})
export class IntegrationsModule {}
