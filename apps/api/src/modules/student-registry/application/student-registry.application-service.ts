import { Inject, Injectable } from '@nestjs/common';

import { StudentRegistryDomainService } from '../domain/student-registry.domain-service.js';
import { StudentRegistryPolicy } from '../policies/student-registry.policy.js';
import type { StudentRegistryRepository } from '../repositories/student-registry.repository.js';
import { STUDENT_REGISTRY_REPOSITORY } from '../repositories/student-registry.repository.js';

/**
 * Application-service placeholder for Student Registry.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class StudentRegistryApplicationService {
  constructor(
    private readonly domainService: StudentRegistryDomainService,
    private readonly policy: StudentRegistryPolicy,
    @Inject(STUDENT_REGISTRY_REPOSITORY) private readonly repository: StudentRegistryRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'Student Registry',
      ready: false,
    };
  }
}
