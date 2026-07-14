/**
 * Public API for the StudentRegistry bounded context.
 * Other modules and composition roots may import only from this barrel.
 * Internal folders (application internals, domain, controllers, policies, placeholders)
 * are not part of the public contract.
 */
export { StudentRegistryModule } from './student-registry.module.js';
export { StudentRegistryApplicationService } from './application/student-registry.application-service.js';
export { StudentRegistryEventNames } from './events/student-registry.events.js';
export type { StudentRegistrySkeletonRegisteredEvent } from './events/student-registry.events.js';
export { STUDENT_REGISTRY_SKELETON_DTO } from './dto/student-registry.dto.js';
export type { StudentRegistrySkeletonDto } from './dto/student-registry.dto.js';
