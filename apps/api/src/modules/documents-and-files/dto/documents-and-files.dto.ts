/**
 * Neutral DTO namespace for Documents And Files.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type DocumentsAndFilesSkeletonDto = {
  readonly boundedContext: 'Documents And Files';
  readonly status: 'skeleton';
};

export const DOCUMENTS_AND_FILES_SKELETON_DTO: DocumentsAndFilesSkeletonDto = {
  boundedContext: 'Documents And Files',
  status: 'skeleton',
};
