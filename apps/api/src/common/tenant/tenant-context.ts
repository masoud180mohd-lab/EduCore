/**
 * Request-scoped tenant context (application layer).
 * Does not set PostgreSQL GUCs; use transaction-scoped helpers when opening DB work.
 */
export type TenantContext = {
  readonly tenantId: string;
};

/**
 * UUID string shape (v1–v8 inclusive of nil-style forms used in seeds).
 * Rejects empty / non-UUID values for fail-closed tenant isolation.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function parseTenantIdHeader(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }
  return trimmed;
}

/**
 * SQL fragments / guidance for transaction-local RLS GUCs.
 * Callers MUST set and clear within a single transaction — never on a pooled connection outside a txn.
 *
 * Example (pg client inside BEGIN):
 *   SELECT set_config('app.current_tenant', $1, true);
 *   SELECT set_config('app.current_user', $2, true);
 *   -- work --
 *   COMMIT;  -- clears local configs
 */
export const TENANT_GUC_SET_LOCAL = {
  currentTenant: `SELECT set_config('app.current_tenant', $1, true)`,
  currentUser: `SELECT set_config('app.current_user', $2, true)`,
} as const;
