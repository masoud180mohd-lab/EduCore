/**
 * Read path: tenant settings document for the bound tenant (RLS Pattern A).
 * No put/replace — product read increments only.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type TenantSettingsRow = {
  readonly schemaVersion: number;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly updatedAt: string;
};

@Injectable()
export class TenantSettingsRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  /**
   * Settings for bound tenant if visible under RLS.
   * Returns null when missing or inaccessible (caller maps to 404).
   * Fail-closed on DB errors (warn + null).
   */
  async getForTenant(userId: string, tenantId: string): Promise<TenantSettingsRow | null> {
    if (!isUuid(userId) || !isUuid(tenantId) || this.pool === null) {
      return null;
    }

    try {
      return await withTenantTransaction(this.pool, { userId, tenantId }, async (client) => {
        const result = await client.query<{
          schema_version: number;
          settings: unknown;
          updated_at: Date;
        }>(
          `SELECT s.schema_version, s.settings, s.updated_at
           FROM tenant_settings s
           WHERE s.tenant_id = $1::uuid
           LIMIT 1`,
          [tenantId],
        );
        const row = result.rows[0];
        if (row === undefined) {
          return null;
        }
        return {
          schemaVersion: row.schema_version,
          settings: asSettingsObject(row.settings),
          updatedAt: new Date(row.updated_at).toISOString(),
        };
      });
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'TenantSettingsRepository', error, {
        operation: 'getForTenant',
      });
      return null;
    }
  }
}

function asSettingsObject(value: unknown): Readonly<Record<string, unknown>> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Readonly<Record<string, unknown>>;
  }
  return {};
}
