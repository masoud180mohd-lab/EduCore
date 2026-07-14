import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for Identity And Access.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class IdentityAndAccessDomainService {
  contextName(): string {
    return 'Identity And Access';
  }
}
