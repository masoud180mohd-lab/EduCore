import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for Student Registry.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class StudentRegistryDomainService {
  contextName(): string {
    return 'Student Registry';
  }
}
