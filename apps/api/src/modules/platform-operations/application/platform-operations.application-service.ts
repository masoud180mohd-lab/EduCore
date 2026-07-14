import { Inject, Injectable } from '@nestjs/common';

import { PlatformOperationsDomainService } from '../domain/platform-operations.domain-service.js';
import { PlatformOperationsPolicy } from '../policies/platform-operations.policy.js';
import type { PlatformOperationsRepository } from '../repositories/platform-operations.repository.js';
import { PLATFORM_OPERATIONS_REPOSITORY } from '../repositories/platform-operations.repository.js';

/**
 * Application-service placeholder for Platform Operations.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class PlatformOperationsApplicationService {
  constructor(
    private readonly domainService: PlatformOperationsDomainService,
    private readonly policy: PlatformOperationsPolicy,
    @Inject(PLATFORM_OPERATIONS_REPOSITORY)
    private readonly repository: PlatformOperationsRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'Platform Operations',
      ready: false,
    };
  }
}
