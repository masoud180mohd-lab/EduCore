import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { PlatformOperationsModule } from '../platform-operations/index.js';
import { AcademicStructureApplicationService } from './application/academic-structure.application-service.js';
import { AcademicYearsService } from './application/academic-years.service.js';
import { ClassesService } from './application/classes.service.js';
import { EnrollmentsService } from './application/enrollments.service.js';
import { StreamsService } from './application/streams.service.js';
import { SubjectsService } from './application/subjects.service.js';
import { TermsService } from './application/terms.service.js';
import { AcademicStructureController } from './controllers/academic-structure.controller.js';
import { AcademicYearsController } from './controllers/academic-years.controller.js';
import { ClassesController } from './controllers/classes.controller.js';
import { EnrollmentsController } from './controllers/enrollments.controller.js';
import { StreamsController } from './controllers/streams.controller.js';
import { SubjectsController } from './controllers/subjects.controller.js';
import { TermsController } from './controllers/terms.controller.js';
import { AcademicStructureDomainService } from './domain/academic-structure.domain-service.js';
import { AcademicStructurePolicy } from './policies/academic-structure.policy.js';
import { ACADEMIC_STRUCTURE_REPOSITORY } from './repositories/academic-structure.repository.js';
import { AcademicStructureRepositoryPlaceholder } from './repositories/academic-structure.repository.placeholder.js';
import { AcademicYearsRepository } from './repositories/academic-years.repository.js';
import { ClassesRepository } from './repositories/classes.repository.js';
import { EnrollmentsRepository } from './repositories/enrollments.repository.js';
import { StreamsRepository } from './repositories/streams.repository.js';
import { SubjectsRepository } from './repositories/subjects.repository.js';
import { TermsRepository } from './repositories/terms.repository.js';

/**
 * Bounded context: Academic Structure.
 * Years, terms, classes, streams, subjects, enrollments product surfaces.
 */
@Module({
  imports: [DatabaseModule, PlatformOperationsModule],
  controllers: [
    AcademicStructureController,
    AcademicYearsController,
    TermsController,
    ClassesController,
    StreamsController,
    SubjectsController,
    EnrollmentsController,
  ],
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
    TermsRepository,
    TermsService,
    ClassesRepository,
    ClassesService,
    StreamsRepository,
    StreamsService,
    SubjectsRepository,
    SubjectsService,
    EnrollmentsRepository,
    EnrollmentsService,
  ],
  exports: [
    AcademicStructureApplicationService,
    ACADEMIC_STRUCTURE_REPOSITORY,
    AcademicYearsService,
    TermsService,
    ClassesService,
    StreamsService,
    SubjectsService,
    EnrollmentsService,
  ],
})
export class AcademicStructureModule {}
