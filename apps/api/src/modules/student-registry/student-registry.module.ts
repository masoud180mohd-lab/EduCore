import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { PlatformOperationsModule } from '../platform-operations/index.js';
import { GuardiansService } from './application/guardians.service.js';
import { StudentRegistryApplicationService } from './application/student-registry.application-service.js';
import { StudentsService } from './application/students.service.js';
import { GuardiansController } from './controllers/guardians.controller.js';
import { StudentRegistryController } from './controllers/student-registry.controller.js';
import { StudentsController } from './controllers/students.controller.js';
import { StudentSelfController } from './controllers/student-self.controller.js';
import { StudentRegistryDomainService } from './domain/student-registry.domain-service.js';
import { StudentRegistryPolicy } from './policies/student-registry.policy.js';
import { GuardiansRepository } from './repositories/guardians.repository.js';
import { STUDENT_REGISTRY_REPOSITORY } from './repositories/student-registry.repository.js';
import { StudentRegistryRepositoryPlaceholder } from './repositories/student-registry.repository.placeholder.js';
import { StudentsRepository } from './repositories/students.repository.js';

/**
 * Bounded context: Student Registry.
 * Product: students (ACF-002) + guardians/links (ACF-010) + portal bind (ACF-013 / DSF-009).
 */
@Module({
  imports: [DatabaseModule, PlatformOperationsModule],
  controllers: [
    StudentRegistryController,
    StudentsController,
    StudentSelfController,
    GuardiansController,
  ],
  providers: [
    StudentRegistryApplicationService,
    StudentRegistryDomainService,
    StudentRegistryPolicy,
    {
      provide: STUDENT_REGISTRY_REPOSITORY,
      useClass: StudentRegistryRepositoryPlaceholder,
    },
    StudentsRepository,
    StudentsService,
    GuardiansRepository,
    GuardiansService,
  ],
  exports: [
    StudentRegistryApplicationService,
    STUDENT_REGISTRY_REPOSITORY,
    StudentsService,
    GuardiansService,
  ],
})
export class StudentRegistryModule {}
