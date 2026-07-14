import { Inject, Injectable } from '@nestjs/common';

import { IdentityAndAccessDomainService } from '../domain/identity-and-access.domain-service.js';
import { IdentityAndAccessPolicy } from '../policies/identity-and-access.policy.js';
import type { IdentityAndAccessRepository } from '../repositories/identity-and-access.repository.js';
import { IDENTITY_AND_ACCESS_REPOSITORY } from '../repositories/identity-and-access.repository.js';

/**
 * Application-service placeholder for Identity And Access.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class IdentityAndAccessApplicationService {
  constructor(
    private readonly domainService: IdentityAndAccessDomainService,
    private readonly policy: IdentityAndAccessPolicy,
    @Inject(IDENTITY_AND_ACCESS_REPOSITORY)
    private readonly repository: IdentityAndAccessRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'Identity And Access',
      ready: false,
    };
  }
}
