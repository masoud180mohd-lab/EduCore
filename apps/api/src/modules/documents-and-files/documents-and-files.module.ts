import { Module } from '@nestjs/common';

import { DocumentsAndFilesApplicationService } from './application/documents-and-files.application-service.js';
import { DocumentsAndFilesController } from './controllers/documents-and-files.controller.js';
import { DocumentsAndFilesDomainService } from './domain/documents-and-files.domain-service.js';
import { DocumentsAndFilesPolicy } from './policies/documents-and-files.policy.js';
import { DOCUMENTS_AND_FILES_REPOSITORY } from './repositories/documents-and-files.repository.js';
import { DocumentsAndFilesRepositoryPlaceholder } from './repositories/documents-and-files.repository.placeholder.js';

/**
 * Bounded context skeleton: Documents And Files.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [DocumentsAndFilesController],
  providers: [
    DocumentsAndFilesApplicationService,
    DocumentsAndFilesDomainService,
    DocumentsAndFilesPolicy,
    {
      provide: DOCUMENTS_AND_FILES_REPOSITORY,
      useClass: DocumentsAndFilesRepositoryPlaceholder,
    },
  ],
  exports: [DocumentsAndFilesApplicationService, DOCUMENTS_AND_FILES_REPOSITORY],
})
export class DocumentsAndFilesModule {}
