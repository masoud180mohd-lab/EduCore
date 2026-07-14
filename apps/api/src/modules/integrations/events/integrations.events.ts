/**
 * Domain-event names for Integrations.
 * Event payloads and outbox publishing remain deferred.
 */
export const IntegrationsEventNames = {
  skeletonRegistered: 'integrations.skeleton.registered',
} as const;

export type IntegrationsSkeletonRegisteredEvent = {
  readonly eventName: typeof IntegrationsEventNames.skeletonRegistered;
  readonly boundedContext: 'Integrations';
};
