/**
 * Public API for the Assessment bounded context.
 * Other modules and composition roots may import only from this barrel.
 * Internal folders (application internals, domain, controllers, policies, placeholders)
 * are not part of the public contract.
 */
export { AssessmentModule } from './assessment.module.js';
export { AssessmentApplicationService } from './application/assessment.application-service.js';
export { AssessmentEventNames } from './events/assessment.events.js';
export type { AssessmentSkeletonRegisteredEvent } from './events/assessment.events.js';
export { ASSESSMENT_SKELETON_DTO } from './dto/assessment.dto.js';
export type { AssessmentSkeletonDto } from './dto/assessment.dto.js';
export { ASSESSMENT_REPOSITORY } from './repositories/assessment.repository.js';
export type { AssessmentRepository } from './repositories/assessment.repository.js';
