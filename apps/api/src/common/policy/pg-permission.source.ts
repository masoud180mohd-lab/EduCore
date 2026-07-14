import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { PG_POOL } from '../persistence/pg.tokens.js';
import { withTenantTransaction } from '../persistence/tenant-transaction.js';
import { isUuid } from '../tenant/tenant-context.js';
import type { PermissionSource } from './policy-evaluator.js';

/**
 * Loads effective permission codes from user_roles → roles → role_permissions → permissions
 * via `app.user_permission_codes` (SECURITY DEFINER; requires active membership).
 *
 * Fail-closed when pool absent, IDs invalid, or DB errors.
 * One call = one short transaction (not N+1 per permission check on PolicyEvaluator —
 * evaluator still may call getPermissions once per requireAny).
 */
@Injectable()
export class PgPermissionSource implements PermissionSource {
  constructor(@Optional() @Inject(PG_POOL) private readonly pool: Pool | null) {}

  async getPermissions(userId: string, tenantId: string): Promise<ReadonlySet<string>> {
    if (!isUuid(userId) || !isUuid(tenantId)) {
      return new Set();
    }
    if (this.pool === null) {
      return new Set();
    }

    try {
      return await withTenantTransaction(this.pool, { userId, tenantId }, async (client) => {
        const result = await client.query<{ code: string }>(
          `SELECT t.code FROM app.user_permission_codes($1::uuid) AS t(code)`,
          [tenantId],
        );
        return new Set(result.rows.map((row) => row.code));
      });
    } catch {
      return new Set();
    }
  }
}
