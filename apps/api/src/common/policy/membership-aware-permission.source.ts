import { Inject, Injectable } from '@nestjs/common';

import type { TenantMembershipChecker } from '../tenant/tenant-membership.checker.js';
import { TENANT_MEMBERSHIP_CHECKER } from '../tenant/tenant-membership.checker.js';
import type { PermissionSource } from './policy-evaluator.js';

/**
 * Wraps an inner PermissionSource and denies all permissions when membership is inactive.
 * Role/permission catalogue loading remains the inner source
 * (`PgPermissionSource` when app DB pool is enabled, else Empty).
 *
 * Avoids elevating non-members who somehow reach RequirePermission without RequireActiveMembership.
 */
@Injectable()
export class MembershipAwarePermissionSource implements PermissionSource {
  constructor(
    @Inject(TENANT_MEMBERSHIP_CHECKER)
    private readonly membershipChecker: TenantMembershipChecker,
    @Inject(MembershipAwarePermissionSource.INNER)
    private readonly inner: PermissionSource,
  ) {}

  /** DI token for the inner (role/catalogue) permission source. */
  static readonly INNER = Symbol('INNER_PERMISSION_SOURCE');

  async getPermissions(userId: string, tenantId: string): Promise<ReadonlySet<string>> {
    const active = await this.membershipChecker.hasActiveMembership(userId, tenantId);
    if (!active) {
      return new Set();
    }
    return this.inner.getPermissions(userId, tenantId);
  }
}
