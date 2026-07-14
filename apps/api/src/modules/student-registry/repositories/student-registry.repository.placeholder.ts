import { Injectable } from '@nestjs/common';

import type { StudentRegistryRepository } from './student-registry.repository.js';

/**
 * Non-persistent repository placeholder for Student Registry.
 */
@Injectable()
export class StudentRegistryRepositoryPlaceholder implements StudentRegistryRepository {
  readonly boundedContext = 'Student Registry' as const;
}
