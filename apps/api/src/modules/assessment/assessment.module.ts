import { Module } from '@nestjs/common';

import { AssessmentApplicationService } from './application/assessment.application-service.js';
import { AssessmentController } from './controllers/assessment.controller.js';
import { AssessmentDomainService } from './domain/assessment.domain-service.js';
import { AssessmentPolicy } from './policies/assessment.policy.js';
import { ASSESSMENT_REPOSITORY } from './repositories/assessment.repository.js';
import { AssessmentRepositoryPlaceholder } from './repositories/assessment.repository.placeholder.js';

/**
 * Bounded context skeleton: Assessment.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [AssessmentController],
  providers: [
    AssessmentApplicationService,
    AssessmentDomainService,
    AssessmentPolicy,
    {
      provide: ASSESSMENT_REPOSITORY,
      useClass: AssessmentRepositoryPlaceholder,
    },
  ],
  exports: [AssessmentApplicationService, ASSESSMENT_REPOSITORY],
})
export class AssessmentModule {}
