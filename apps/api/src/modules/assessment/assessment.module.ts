import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { PlatformOperationsModule } from '../platform-operations/index.js';
import { AssessmentApplicationService } from './application/assessment.application-service.js';
import { MarksService } from './application/marks.service.js';
import { AssessmentController } from './controllers/assessment.controller.js';
import { MarksController } from './controllers/marks.controller.js';
import { AssessmentDomainService } from './domain/assessment.domain-service.js';
import { AssessmentPolicy } from './policies/assessment.policy.js';
import { ASSESSMENT_REPOSITORY } from './repositories/assessment.repository.js';
import { AssessmentRepositoryPlaceholder } from './repositories/assessment.repository.placeholder.js';
import { MarksRepository } from './repositories/marks.repository.js';

/**
 * Bounded context: Assessment.
 * Exams / exam subjects / marks product surfaces (IMP-008 / ACF-011).
 */
@Module({
  imports: [DatabaseModule, PlatformOperationsModule],
  controllers: [AssessmentController, MarksController],
  providers: [
    AssessmentApplicationService,
    AssessmentDomainService,
    AssessmentPolicy,
    {
      provide: ASSESSMENT_REPOSITORY,
      useClass: AssessmentRepositoryPlaceholder,
    },
    MarksRepository,
    MarksService,
  ],
  exports: [AssessmentApplicationService, ASSESSMENT_REPOSITORY, MarksService],
})
export class AssessmentModule {}
