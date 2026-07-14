/**
 * Public API for the Payments bounded context.
 * Other modules and composition roots may import only from this barrel.
 * Internal folders (application internals, domain, controllers, policies, placeholders)
 * are not part of the public contract.
 */
export { PaymentsModule } from './payments.module.js';
export { PaymentsApplicationService } from './application/payments.application-service.js';
export { PaymentsEventNames } from './events/payments.events.js';
export type { PaymentsSkeletonRegisteredEvent } from './events/payments.events.js';
export { PAYMENTS_SKELETON_DTO } from './dto/payments.dto.js';
export type { PaymentsSkeletonDto } from './dto/payments.dto.js';
