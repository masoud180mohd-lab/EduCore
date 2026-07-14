/**
 * Public API for the PlatformOperations bounded context.
 * Other modules and composition roots may import only from this barrel.
 * Internal folders (application internals, domain, controllers, policies, placeholders)
 * are not part of the public contract — except audit publisher types/symbols exported below.
 */
export { PlatformOperationsModule } from './platform-operations.module.js';
export { PlatformOperationsApplicationService } from './application/platform-operations.application-service.js';
export { PlatformOperationsEventNames } from './events/platform-operations.events.js';
export type { PlatformOperationsSkeletonRegisteredEvent } from './events/platform-operations.events.js';
export { PLATFORM_OPERATIONS_SKELETON_DTO } from './dto/platform-operations.dto.js';
export type { PlatformOperationsSkeletonDto } from './dto/platform-operations.dto.js';
/** Audit publisher foundation (IMP-001-T19) — public cross-module surface. */
export {
  AUDIT_PUBLISHER,
  InMemoryAuditPublisher,
  NoopAuditPublisher,
  redactAuditMetadata,
  sanitizeAuditEvent,
} from './audit/audit-publisher.js';
export type { AuditEventInput, AuditOutcome, AuditPublisher } from './audit/audit-publisher.js';
