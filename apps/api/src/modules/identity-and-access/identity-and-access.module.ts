import { Module } from '@nestjs/common';

import { IdentityAndAccessApplicationService } from './application/identity-and-access.application-service.js';
import { IdentityAndAccessController } from './controllers/identity-and-access.controller.js';
import { IdentityAndAccessDomainService } from './domain/identity-and-access.domain-service.js';
import { IdentityAndAccessPolicy } from './policies/identity-and-access.policy.js';
import { IDENTITY_AND_ACCESS_REPOSITORY } from './repositories/identity-and-access.repository.js';
import { IdentityAndAccessRepositoryPlaceholder } from './repositories/identity-and-access.repository.placeholder.js';

/**
 * Bounded context skeleton: Identity And Access.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [IdentityAndAccessController],
  providers: [
    IdentityAndAccessApplicationService,
    IdentityAndAccessDomainService,
    IdentityAndAccessPolicy,
    {
      provide: IDENTITY_AND_ACCESS_REPOSITORY,
      useClass: IdentityAndAccessRepositoryPlaceholder,
    },
  ],
  exports: [IdentityAndAccessApplicationService, IDENTITY_AND_ACCESS_REPOSITORY],
})
export class IdentityAndAccessModule {}
