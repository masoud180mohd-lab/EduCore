import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for Documents And Files.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class DocumentsAndFilesDomainService {
  contextName(): string {
    return 'Documents And Files';
  }
}
