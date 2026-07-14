/**
 * Public API for the DocumentsAndFiles bounded context.
 * Other modules and composition roots may import only from this barrel.
 * Internal folders (application internals, domain, controllers, policies, placeholders)
 * are not part of the public contract.
 */
export { DocumentsAndFilesModule } from './documents-and-files.module.js';
export { DocumentsAndFilesApplicationService } from './application/documents-and-files.application-service.js';
export { DocumentsAndFilesEventNames } from './events/documents-and-files.events.js';
export type { DocumentsAndFilesSkeletonRegisteredEvent } from './events/documents-and-files.events.js';
export { DOCUMENTS_AND_FILES_SKELETON_DTO } from './dto/documents-and-files.dto.js';
export type { DocumentsAndFilesSkeletonDto } from './dto/documents-and-files.dto.js';
