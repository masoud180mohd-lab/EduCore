import { Injectable } from '@nestjs/common';

import type { DocumentsAndFilesRepository } from './documents-and-files.repository.js';

/**
 * Non-persistent repository placeholder for Documents And Files.
 */
@Injectable()
export class DocumentsAndFilesRepositoryPlaceholder implements DocumentsAndFilesRepository {
  readonly boundedContext = 'Documents And Files' as const;
}
