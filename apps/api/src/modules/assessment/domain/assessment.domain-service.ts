import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for Assessment.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class AssessmentDomainService {
  contextName(): string {
    return 'Assessment';
  }
}
