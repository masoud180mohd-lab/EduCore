import { Module } from '@nestjs/common';

import { PlatformOperationsApplicationService } from './application/platform-operations.application-service.js';
import { PlatformOperationsController } from './controllers/platform-operations.controller.js';
import { PlatformOperationsDomainService } from './domain/platform-operations.domain-service.js';
import { PlatformOperationsPolicy } from './policies/platform-operations.policy.js';
import { PLATFORM_OPERATIONS_REPOSITORY } from './repositories/platform-operations.repository.js';
import { PlatformOperationsRepositoryPlaceholder } from './repositories/platform-operations.repository.placeholder.js';

/**
 * Bounded context skeleton: Platform Operations.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [PlatformOperationsController],
  providers: [
    PlatformOperationsApplicationService,
    PlatformOperationsDomainService,
    PlatformOperationsPolicy,
    {
      provide: PLATFORM_OPERATIONS_REPOSITORY,
      useClass: PlatformOperationsRepositoryPlaceholder,
    },
  ],
  exports: [PlatformOperationsApplicationService, PLATFORM_OPERATIONS_REPOSITORY],
})
export class PlatformOperationsModule {}
