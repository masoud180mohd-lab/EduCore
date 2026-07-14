import { Inject, Injectable } from '@nestjs/common';

import { IntegrationsDomainService } from '../domain/integrations.domain-service.js';
import { IntegrationsPolicy } from '../policies/integrations.policy.js';
import type { IntegrationsRepository } from '../repositories/integrations.repository.js';
import { INTEGRATIONS_REPOSITORY } from '../repositories/integrations.repository.js';

/**
 * Application-service placeholder for Integrations.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class IntegrationsApplicationService {
  constructor(
    private readonly domainService: IntegrationsDomainService,
    private readonly policy: IntegrationsPolicy,
    @Inject(INTEGRATIONS_REPOSITORY) private readonly repository: IntegrationsRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'Integrations',
      ready: false,
    };
  }
}
