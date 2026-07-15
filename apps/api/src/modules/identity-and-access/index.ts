/**
 * Public API for the IdentityAndAccess bounded context.
 * Other modules and composition roots may import only from this barrel.
 * SessionRepository stays module-private (AUDIT-R3); TokenValidator is provided
 * by IdentityAndAccessModule and consumed via DI (not deep imports).
 */
export { IdentityAndAccessModule } from './identity-and-access.module.js';
export { IdentityAndAccessApplicationService } from './application/identity-and-access.application-service.js';
export { IdentityAndAccessEventNames } from './events/identity-and-access.events.js';
export type { IdentityAndAccessSkeletonRegisteredEvent } from './events/identity-and-access.events.js';
export { IDENTITY_AND_ACCESS_SKELETON_DTO } from './dto/identity-and-access.dto.js';
export type { IdentityAndAccessSkeletonDto } from './dto/identity-and-access.dto.js';
export { AuthService } from './auth/auth.service.js';
export { RbacReadRepository } from './rbac/rbac-read.repository.js';
export {
  SYSTEM_ROLE_CODES,
  SYSTEM_ROLE_DEFINITIONS,
  isSystemRoleCode,
  permissionsForSystemRole,
} from './rbac/system-roles.js';
export type { SystemRoleCode, SystemRoleDefinition } from './rbac/system-roles.js';
export { bootstrapSystemRolesForTenant } from './rbac/system-role-bootstrap.js';
