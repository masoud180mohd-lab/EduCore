import { Module } from '@nestjs/common';

import { AcademicStructureApplicationService } from './application/academic-structure.application-service.js';
import { AcademicStructureController } from './controllers/academic-structure.controller.js';
import { AcademicStructureDomainService } from './domain/academic-structure.domain-service.js';
import { AcademicStructurePolicy } from './policies/academic-structure.policy.js';
import { ACADEMIC_STRUCTURE_REPOSITORY } from './repositories/academic-structure.repository.js';
import { AcademicStructureRepositoryPlaceholder } from './repositories/academic-structure.repository.placeholder.js';

/**
 * Bounded context skeleton: Academic Structure.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [AcademicStructureController],
  providers: [
    AcademicStructureApplicationService,
    AcademicStructureDomainService,
    AcademicStructurePolicy,
    {
      provide: ACADEMIC_STRUCTURE_REPOSITORY,
      useClass: AcademicStructureRepositoryPlaceholder,
    },
  ],
  exports: [AcademicStructureApplicationService, ACADEMIC_STRUCTURE_REPOSITORY],
})
export class AcademicStructureModule {}
