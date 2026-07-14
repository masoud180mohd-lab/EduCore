import { Injectable } from '@nestjs/common';

import type { AcademicStructureRepository } from './academic-structure.repository.js';

/**
 * Non-persistent repository placeholder for Academic Structure.
 */
@Injectable()
export class AcademicStructureRepositoryPlaceholder implements AcademicStructureRepository {
  readonly boundedContext = 'Academic Structure' as const;
}
