/**
 * Domain-event names for Student Registry.
 * Event payloads and outbox publishing remain deferred.
 */
export const StudentRegistryEventNames = {
  skeletonRegistered: 'student-registry.skeleton.registered',
} as const;

export type StudentRegistrySkeletonRegisteredEvent = {
  readonly eventName: typeof StudentRegistryEventNames.skeletonRegistered;
  readonly boundedContext: 'Student Registry';
};
