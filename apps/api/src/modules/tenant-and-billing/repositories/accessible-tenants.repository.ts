/**
 * Read path: tenants visible to a user via active membership (RLS Pattern B).
 * No create/update/delete — product read increments only.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PAGINATION_MAX_LIMIT } from '../../../common/pagination/index.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withUserRlsTransaction } from '../../../common/persistence/user-rls-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

/**
 * Soft safety cap for the unpaginated picker list (AUDIT-R4 Low).
 * Same ceiling as paginated lists; picker UX is expected to stay far below this.
 */
export const ACCESSIBLE_TENANTS_LIST_CAP = PAGINATION_MAX_LIMIT;

export type AccessibleTenantRow = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
  readonly primaryLocale: string;
  readonly timezone: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

@Injectable()
export class AccessibleTenantsRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  /**
   * Returns tenants the user may see under RLS (active membership via can_see_tenant).
   * Intentionally unpaginated envelope (`{ data }`) for post-login picker UX.
   * Soft-capped at {@link ACCESSIBLE_TENANTS_LIST_CAP}; truncates with a warn if exceeded.
   * Fail-closed: invalid user / no pool / errors → empty list (warn on DB errors).
   */
  async listAccessibleTenants(userId: string): Promise<ReadonlyArray<AccessibleTenantRow>> {
    if (!isUuid(userId) || this.pool === null) {
      return [];
    }

    try {
      return await withUserRlsTransaction(this.pool, userId, async (client) => {
        const result = await client.query<{
          id: string;
          code: string;
          name: string;
          status: string;
          primary_locale: string;
          timezone: string;
          created_at: Date;
          updated_at: Date;
        }>(
          `SELECT t.id, t.code, t.name, t.status, t.primary_locale, t.timezone,
                  t.created_at, t.updated_at
           FROM tenants t
           ORDER BY t.code ASC
           LIMIT $1`,
          [ACCESSIBLE_TENANTS_LIST_CAP + 1],
        );
        const truncated = result.rows.length > ACCESSIBLE_TENANTS_LIST_CAP;
        const pageRows = truncated
          ? result.rows.slice(0, ACCESSIBLE_TENANTS_LIST_CAP)
          : result.rows;
        if (truncated) {
          this.logger?.warn('AccessibleTenantsRepository.listAccessibleTenants truncated', {
            component: 'AccessibleTenantsRepository',
            operation: 'listAccessibleTenants',
            cap: ACCESSIBLE_TENANTS_LIST_CAP,
          });
        }
        return pageRows.map((row) => mapTenantRow(row));
      });
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AccessibleTenantsRepository', error, {
        operation: 'listAccessibleTenants',
      });
      return [];
    }
  }

  /**
   * Single tenant by id if visible under RLS (active membership).
   * Returns null when missing or not accessible (caller maps to 404 — no existence leak).
   * Fail-closed on DB errors (warn + null).
   */
  async getAccessibleTenantById(
    userId: string,
    tenantId: string,
  ): Promise<AccessibleTenantRow | null> {
    if (!isUuid(userId) || !isUuid(tenantId) || this.pool === null) {
      return null;
    }

    try {
      return await withUserRlsTransaction(this.pool, userId, async (client) => {
        const result = await client.query<{
          id: string;
          code: string;
          name: string;
          status: string;
          primary_locale: string;
          timezone: string;
          created_at: Date;
          updated_at: Date;
        }>(
          `SELECT t.id, t.code, t.name, t.status, t.primary_locale, t.timezone,
                  t.created_at, t.updated_at
           FROM tenants t
           WHERE t.id = $1::uuid
           LIMIT 1`,
          [tenantId],
        );
        const row = result.rows[0];
        return row === undefined ? null : mapTenantRow(row);
      });
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AccessibleTenantsRepository', error, {
        operation: 'getAccessibleTenantById',
      });
      return null;
    }
  }

  /**
   * Update tenant profile via app.tenant_update_profile helper.
   */
  async updateTenantProfile(
    userId: string,
    tenantId: string,
    input: {
      readonly name?: string;
      readonly timezone?: string;
      readonly primaryLocale?: string;
    },
  ): Promise<AccessibleTenantRow | null> {
    if (!isUuid(userId) || !isUuid(tenantId) || this.pool === null) {
      return null;
    }

    try {
      return await withUserRlsTransaction(this.pool, userId, async (client) => {
        const result = await client.query<{
          id: string;
          code: string;
          name: string;
          status: string;
          primary_locale: string;
          timezone: string;
          created_at: Date;
          updated_at: Date;
        }>(`SELECT * FROM app.tenant_update_profile($1::uuid, $2::text, $3::text, $4::text)`, [
          tenantId,
          input.name ?? null,
          input.timezone ?? null,
          input.primaryLocale ?? null,
        ]);
        const row = result.rows[0];
        return row === undefined ? null : mapTenantRow(row);
      });
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AccessibleTenantsRepository', error, {
        operation: 'updateTenantProfile',
      });
      return null;
    }
  }
}

function mapTenantRow(row: {
  id: string;
  code: string;
  name: string;
  status: string;
  primary_locale: string;
  timezone: string;
  created_at: Date;
  updated_at: Date;
}): AccessibleTenantRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    primaryLocale: row.primary_locale,
    timezone: row.timezone,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
