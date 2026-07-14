import { Module } from '@nestjs/common';

import { PlatformOperationsApplicationService } from './application/platform-operations.application-service.js';
import { AUDIT_PUBLISHER, NoopAuditPublisher } from './audit/audit-publisher.js';
import { PlatformOperationsController } from './controllers/platform-operations.controller.js';
import { PlatformOperationsDomainService } from './domain/platform-operations.domain-service.js';
import { PlatformOperationsPolicy } from './policies/platform-operations.policy.js';
import { PLATFORM_OPERATIONS_REPOSITORY } from './repositories/platform-operations.repository.js';
import { PlatformOperationsRepositoryPlaceholder } from './repositories/platform-operations.repository.placeholder.js';

/**
 * Bounded context: Platform Operations.
 * Audit publisher foundation (IMP-001-T19); no business HTTP routes yet.
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
    {
      provide: AUDIT_PUBLISHER,
      useClass: NoopAuditPublisher,
    },
  ],
  exports: [PlatformOperationsApplicationService, PLATFORM_OPERATIONS_REPOSITORY, AUDIT_PUBLISHER],
})
export class PlatformOperationsModule {}
