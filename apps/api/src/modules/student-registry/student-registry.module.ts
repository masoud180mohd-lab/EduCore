import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { PlatformOperationsModule } from '../platform-operations/index.js';
import { StudentRegistryApplicationService } from './application/student-registry.application-service.js';
import { StudentsService } from './application/students.service.js';
import { StudentRegistryController } from './controllers/student-registry.controller.js';
import { StudentsController } from './controllers/students.controller.js';
import { StudentRegistryDomainService } from './domain/student-registry.domain-service.js';
import { StudentRegistryPolicy } from './policies/student-registry.policy.js';
import { STUDENT_REGISTRY_REPOSITORY } from './repositories/student-registry.repository.js';
import { StudentRegistryRepositoryPlaceholder } from './repositories/student-registry.repository.placeholder.js';
import { StudentsRepository } from './repositories/students.repository.js';

/**
 * Bounded context: Student Registry.
 * Product: GET list/detail (P0/P1) + POST create (P2). PATCH/DELETE closed.
 */
@Module({
  imports: [DatabaseModule, PlatformOperationsModule],
  controllers: [StudentRegistryController, StudentsController],
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
  ],
  exports: [StudentRegistryApplicationService, STUDENT_REGISTRY_REPOSITORY, StudentsService],
})
export class StudentRegistryModule {}
