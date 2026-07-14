import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for Communication.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class CommunicationDomainService {
  contextName(): string {
    return 'Communication';
  }
}
