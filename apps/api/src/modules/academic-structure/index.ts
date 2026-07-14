/**
 * Public API for the AcademicStructure bounded context.
 * Other modules and composition roots may import only from this barrel.
 * Internal folders (application internals, domain, controllers, policies, placeholders)
 * are not part of the public contract.
 */
export { AcademicStructureModule } from './academic-structure.module.js';
export { AcademicStructureApplicationService } from './application/academic-structure.application-service.js';
export { AcademicStructureEventNames } from './events/academic-structure.events.js';
export type { AcademicStructureSkeletonRegisteredEvent } from './events/academic-structure.events.js';
export { ACADEMIC_STRUCTURE_SKELETON_DTO } from './dto/academic-structure.dto.js';
export type { AcademicStructureSkeletonDto } from './dto/academic-structure.dto.js';
