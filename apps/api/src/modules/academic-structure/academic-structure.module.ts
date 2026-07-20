import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { AcademicStructureApplicationService } from './application/academic-structure.application-service.js';
import { AcademicYearsService } from './application/academic-years.service.js';
import { AcademicStructureController } from './controllers/academic-structure.controller.js';
import { AcademicYearsController } from './controllers/academic-years.controller.js';
import { AcademicStructureDomainService } from './domain/academic-structure.domain-service.js';
import { AcademicStructurePolicy } from './policies/academic-structure.policy.js';
import { ACADEMIC_STRUCTURE_REPOSITORY } from './repositories/academic-structure.repository.js';
import { AcademicStructureRepositoryPlaceholder } from './repositories/academic-structure.repository.placeholder.js';
import { AcademicYearsRepository } from './repositories/academic-years.repository.js';

/**
 * Bounded context: Academic Structure.
 * Product: GET /api/v1/academic-years list (IMP-003-P0). Writes closed.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [AcademicStructureController, AcademicYearsController],
  providers: [
    AcademicStructureApplicationService,
    AcademicStructureDomainService,
    AcademicStructurePolicy,
    {
      provide: ACADEMIC_STRUCTURE_REPOSITORY,
      useClass: AcademicStructureRepositoryPlaceholder,
    },
    AcademicYearsRepository,
    AcademicYearsService,
  ],
  exports: [
    AcademicStructureApplicationService,
    ACADEMIC_STRUCTURE_REPOSITORY,
    AcademicYearsService,
  ],
})
export class AcademicStructureModule {}
