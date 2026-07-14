/**
 * Domain-event names for Assessment.
 * Event payloads and outbox publishing remain deferred.
 */
export const AssessmentEventNames = {
  skeletonRegistered: 'assessment.skeleton.registered',
} as const;

export type AssessmentSkeletonRegisteredEvent = {
  readonly eventName: typeof AssessmentEventNames.skeletonRegistered;
  readonly boundedContext: 'Assessment';
};
