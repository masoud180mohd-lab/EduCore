import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../logging/fail-closed-log.js';
import type { AppLogger } from '../logging/logger.js';
import { APP_LOGGER } from '../logging/logger.tokens.js';
import { PG_POOL } from '../persistence/pg.tokens.js';
import { withTenantTransaction } from '../persistence/tenant-transaction.js';
import { isUuid } from './tenant-context.js';
import type { TenantMembershipChecker } from './tenant-membership.checker.js';

/**
 * DB-backed membership check against `tenant_memberships` via
 * `app.user_has_active_membership` (SECURITY DEFINER) under transaction-local GUCs.
 *
 * Fail-closed: invalid UUIDs, missing pool, or query errors → false (guard maps to 403).
 * DB errors still deny but emit a warn for ops visibility (no secrets).
 */
@Injectable()
export class PgTenantMembershipChecker implements TenantMembershipChecker {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  async hasActiveMembership(userId: string, tenantId: string): Promise<boolean> {
    if (!isUuid(userId) || !isUuid(tenantId)) {
      return false;
    }
    if (this.pool === null) {
      return false;
    }

    try {
      return await withTenantTransaction(this.pool, { userId, tenantId }, async (client) => {
        const result = await client.query<{ ok: boolean }>(
          `SELECT app.user_has_active_membership($1::uuid) AS ok`,
          [tenantId],
        );
        return result.rows[0]?.ok === true;
      });
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'PgTenantMembershipChecker', error, {
        operation: 'hasActiveMembership',
      });
      return false;
    }
  }
}
