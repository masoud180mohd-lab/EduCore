/**
 * Domain-event names for Communication.
 * Event payloads and outbox publishing remain deferred.
 */
export const CommunicationEventNames = {
  skeletonRegistered: 'communication.skeleton.registered',
} as const;

export type CommunicationSkeletonRegisteredEvent = {
  readonly eventName: typeof CommunicationEventNames.skeletonRegistered;
  readonly boundedContext: 'Communication';
};
