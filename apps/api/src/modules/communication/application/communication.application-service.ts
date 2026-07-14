import { Inject, Injectable } from '@nestjs/common';

import { CommunicationDomainService } from '../domain/communication.domain-service.js';
import { CommunicationPolicy } from '../policies/communication.policy.js';
import type { CommunicationRepository } from '../repositories/communication.repository.js';
import { COMMUNICATION_REPOSITORY } from '../repositories/communication.repository.js';

/**
 * Application-service placeholder for Communication.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class CommunicationApplicationService {
  constructor(
    private readonly domainService: CommunicationDomainService,
    private readonly policy: CommunicationPolicy,
    @Inject(COMMUNICATION_REPOSITORY) private readonly repository: CommunicationRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'Communication',
      ready: false,
    };
  }
}
