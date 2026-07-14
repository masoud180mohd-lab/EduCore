import { Inject, Injectable } from '@nestjs/common';

import { AcademicStructureDomainService } from '../domain/academic-structure.domain-service.js';
import { AcademicStructurePolicy } from '../policies/academic-structure.policy.js';
import type { AcademicStructureRepository } from '../repositories/academic-structure.repository.js';
import { ACADEMIC_STRUCTURE_REPOSITORY } from '../repositories/academic-structure.repository.js';

/**
 * Application-service placeholder for Academic Structure.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class AcademicStructureApplicationService {
  constructor(
    private readonly domainService: AcademicStructureDomainService,
    private readonly policy: AcademicStructurePolicy,
    @Inject(ACADEMIC_STRUCTURE_REPOSITORY) private readonly repository: AcademicStructureRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'Academic Structure',
      ready: false,
    };
  }
}
