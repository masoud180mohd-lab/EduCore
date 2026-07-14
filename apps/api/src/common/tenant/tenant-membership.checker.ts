/**
 * Validates that a user has an active membership on a tenant.
 * Production implementation queries `tenant_memberships` (or SECURITY DEFINER helper).
 * Default is deny-all (fail-closed).
 */
export interface TenantMembershipChecker {
  hasActiveMembership(userId: string, tenantId: string): Promise<boolean>;
}

export const TENANT_MEMBERSHIP_CHECKER = Symbol('TENANT_MEMBERSHIP_CHECKER');

export class DenyAllTenantMembershipChecker implements TenantMembershipChecker {
  hasActiveMembership(_userId: string, _tenantId: string): Promise<boolean> {
    return Promise.resolve(false);
  }
}

/**
 * Test double: allow only explicitly listed (userId, tenantId) pairs.
 */
export class AllowListTenantMembershipChecker implements TenantMembershipChecker {
  private readonly allowed: ReadonlySet<string>;

  constructor(pairs: ReadonlyArray<{ readonly userId: string; readonly tenantId: string }>) {
    this.allowed = new Set(pairs.map((p) => `${p.userId}::${p.tenantId}`));
  }

  hasActiveMembership(userId: string, tenantId: string): Promise<boolean> {
    return Promise.resolve(this.allowed.has(`${userId}::${tenantId}`));
  }
}
