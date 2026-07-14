import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for Academic Structure.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class AcademicStructureDomainService {
  contextName(): string {
    return 'Academic Structure';
  }
}
