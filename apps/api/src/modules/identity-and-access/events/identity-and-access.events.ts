/**
 * Domain-event names for Identity And Access.
 * Event payloads and outbox publishing remain deferred.
 */
export const IdentityAndAccessEventNames = {
  skeletonRegistered: 'identity-and-access.skeleton.registered',
} as const;

export type IdentityAndAccessSkeletonRegisteredEvent = {
  readonly eventName: typeof IdentityAndAccessEventNames.skeletonRegistered;
  readonly boundedContext: 'Identity And Access';
};
