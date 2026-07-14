import { Inject, Injectable } from '@nestjs/common';

import { AssessmentDomainService } from '../domain/assessment.domain-service.js';
import { AssessmentPolicy } from '../policies/assessment.policy.js';
import type { AssessmentRepository } from '../repositories/assessment.repository.js';
import { ASSESSMENT_REPOSITORY } from '../repositories/assessment.repository.js';

/**
 * Application-service placeholder for Assessment.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class AssessmentApplicationService {
  constructor(
    private readonly domainService: AssessmentDomainService,
    private readonly policy: AssessmentPolicy,
    @Inject(ASSESSMENT_REPOSITORY) private readonly repository: AssessmentRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'Assessment',
      ready: false,
    };
  }
}
