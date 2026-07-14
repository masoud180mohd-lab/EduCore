/**
 * Domain-event names for Platform Operations.
 * Event payloads and outbox publishing remain deferred.
 */
export const PlatformOperationsEventNames = {
  skeletonRegistered: 'platform-operations.skeleton.registered',
} as const;

export type PlatformOperationsSkeletonRegisteredEvent = {
  readonly eventName: typeof PlatformOperationsEventNames.skeletonRegistered;
  readonly boundedContext: 'Platform Operations';
};
