/**
 * Session ↔ request tenant binding (IMP-001 P4 hardening).
 * Privileged guards must use the session-bound tenant and reject header mismatch.
 */
import { AppError } from '../errors/app-error.js';
import type { TenantContext } from '../tenant/tenant-context.js';
import type { AuthContext } from './auth-context.js';

/**
 * Ensures the session has an active tenant and that X-Tenant-Id matches it.
 * Returns the session-bound tenant id (authoritative for AuthZ).
 */
export function assertSessionTenantMatchesHeader(auth: AuthContext, tenant: TenantContext): string {
  const sessionTenant = auth.tenantId?.trim();
  if (sessionTenant === undefined || sessionTenant === '') {
    throw AppError.forbidden('Session is not bound to a tenant. Select a tenant first.', {
      reason: 'SESSION_TENANT_UNBOUND',
    });
  }

  const headerTenant = tenant.tenantId.trim();
  if (sessionTenant.toLowerCase() !== headerTenant.toLowerCase()) {
    throw AppError.forbidden('X-Tenant-Id must match the tenant bound on the session.', {
      reason: 'SESSION_TENANT_MISMATCH',
    });
  }

  return sessionTenant;
}
