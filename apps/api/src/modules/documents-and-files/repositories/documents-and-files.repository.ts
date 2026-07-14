/**
 * Persistence contract for Documents And Files.
 * No database adapter is provided before Database Freeze.
 */
export interface DocumentsAndFilesRepository {
  readonly boundedContext: 'Documents And Files';
}

export const DOCUMENTS_AND_FILES_REPOSITORY = Symbol('DOCUMENTS_AND_FILES_REPOSITORY');
