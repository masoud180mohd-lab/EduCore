import { Inject, Injectable } from '@nestjs/common';

import { DocumentsAndFilesDomainService } from '../domain/documents-and-files.domain-service.js';
import { DocumentsAndFilesPolicy } from '../policies/documents-and-files.policy.js';
import type { DocumentsAndFilesRepository } from '../repositories/documents-and-files.repository.js';
import { DOCUMENTS_AND_FILES_REPOSITORY } from '../repositories/documents-and-files.repository.js';

/**
 * Application-service placeholder for Documents And Files.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class DocumentsAndFilesApplicationService {
  constructor(
    private readonly domainService: DocumentsAndFilesDomainService,
    private readonly policy: DocumentsAndFilesPolicy,
    @Inject(DOCUMENTS_AND_FILES_REPOSITORY)
    private readonly repository: DocumentsAndFilesRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'Documents And Files',
      ready: false,
    };
  }
}
