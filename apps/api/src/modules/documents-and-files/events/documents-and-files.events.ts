/**
 * Domain-event names for Documents And Files.
 * Event payloads and outbox publishing remain deferred.
 */
export const DocumentsAndFilesEventNames = {
  skeletonRegistered: 'documents-and-files.skeleton.registered',
} as const;

export type DocumentsAndFilesSkeletonRegisteredEvent = {
  readonly eventName: typeof DocumentsAndFilesEventNames.skeletonRegistered;
  readonly boundedContext: 'Documents And Files';
};
