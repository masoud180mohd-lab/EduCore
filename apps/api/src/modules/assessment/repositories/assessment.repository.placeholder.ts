import { Injectable } from '@nestjs/common';

import type { AssessmentRepository } from './assessment.repository.js';

/**
 * Non-persistent repository placeholder for Assessment.
 */
@Injectable()
export class AssessmentRepositoryPlaceholder implements AssessmentRepository {
  readonly boundedContext = 'Assessment' as const;
}
