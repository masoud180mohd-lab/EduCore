import { Module } from '@nestjs/common';

import { StudentRegistryApplicationService } from './application/student-registry.application-service.js';
import { StudentRegistryController } from './controllers/student-registry.controller.js';
import { StudentRegistryDomainService } from './domain/student-registry.domain-service.js';
import { StudentRegistryPolicy } from './policies/student-registry.policy.js';
import { STUDENT_REGISTRY_REPOSITORY } from './repositories/student-registry.repository.js';
import { StudentRegistryRepositoryPlaceholder } from './repositories/student-registry.repository.placeholder.js';

/**
 * Bounded context skeleton: Student Registry.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [StudentRegistryController],
  providers: [
    StudentRegistryApplicationService,
    StudentRegistryDomainService,
    StudentRegistryPolicy,
    {
      provide: STUDENT_REGISTRY_REPOSITORY,
      useClass: StudentRegistryRepositoryPlaceholder,
    },
  ],
  exports: [StudentRegistryApplicationService, STUDENT_REGISTRY_REPOSITORY],
})
export class StudentRegistryModule {}
