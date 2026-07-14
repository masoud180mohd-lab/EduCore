import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for Platform Operations.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class PlatformOperationsDomainService {
  contextName(): string {
    return 'Platform Operations';
  }
}
