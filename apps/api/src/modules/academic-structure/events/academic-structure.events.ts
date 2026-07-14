/**
 * Domain-event names for Academic Structure.
 * Event payloads and outbox publishing remain deferred.
 */
export const AcademicStructureEventNames = {
  skeletonRegistered: 'academic-structure.skeleton.registered',
} as const;

export type AcademicStructureSkeletonRegisteredEvent = {
  readonly eventName: typeof AcademicStructureEventNames.skeletonRegistered;
  readonly boundedContext: 'Academic Structure';
};
