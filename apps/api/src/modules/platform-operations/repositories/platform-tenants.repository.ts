import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_PLATFORM_POOL, PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withPlatformTransaction } from '../../../common/persistence/platform-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
export const ENTITLEMENT_CODES = ['sms', 'ai', 'payments.momo', 'student_portal'] as const;
export type EntitlementCode = (typeof ENTITLEMENT_CODES)[number];

export type PlatformTenantListRow = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
  readonly primaryLocale: string;
  readonly timezone: string;
  readonly planCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PlatformEntitlementRow = {
  readonly code: string;
  readonly enabled: boolean;
  readonly limit: number | null;
};

export type PlatformTenantDetail = PlatformTenantListRow & {
  readonly entitlements: ReadonlyArray<PlatformEntitlementRow>;
};

export type PlatformPlanRow = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
};

export type PlatformAuditRow = {
  readonly id: string;
  readonly occurredAt: string;
  readonly action: string;
  readonly outcome: string;
  readonly actorUserId: string | null;
  readonly tenantId: string | null;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
};

export type RegisterTenantInput = {
  readonly code: string;
  readonly name: string;
  readonly primaryLocale: 'en' | 'sw';
  readonly timezone: string;
  readonly ownerEmail: string;
  readonly ownerDisplayName: string;
};

export type RegisterTenantResult = {
  readonly tenant: PlatformTenantDetail;
  readonly ownerUserId: string;
  readonly ownerCreated: boolean;
};

@Injectable()
export class PlatformTenantsRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly appPool: Pool | null,
    @Optional() @Inject(PG_PLATFORM_POOL) private readonly platformPool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.platformPool !== null;
  }

  async isActiveSuperAdmin(userId: string): Promise<boolean> {
    if (!isUuid(userId) || this.appPool === null) {
      return false;
    }
    try {
      const result = await this.appPool.query<{ user_id: string }>(
        `SELECT user_id
           FROM platform_operators
          WHERE user_id = $1::uuid
            AND status = 'active'
            AND role = 'super_admin'
          LIMIT 1`,
        [userId],
      );
      return result.rows[0] !== undefined;
    } catch (error) {
      logFailClosedDbError(this.logger, 'platform_operators.lookup', error);
      return false;
    }
  }

  async listTenants(
    actorUserId: string,
    query: {
      readonly limit: number;
      readonly cursor: string | undefined;
      readonly status: string | undefined;
    },
  ): Promise<{ readonly rows: ReadonlyArray<PlatformTenantListRow>; readonly nextCursor: string | null }> {
    if (this.platformPool === null) {
      return { rows: [], nextCursor: null };
    }

    return withPlatformTransaction(this.platformPool, { userId: actorUserId }, async (client) => {
      const params: unknown[] = [query.limit + 1];
      let sql = `
        SELECT t.id, t.code, t.name, t.status, t.primary_locale, t.timezone,
               t.created_at, t.updated_at, p.code AS plan_code
          FROM tenants t
          LEFT JOIN tenant_plan_assignments a
            ON a.tenant_id = t.id AND a.status = 'active'
          LEFT JOIN plans p ON p.id = a.plan_id
         WHERE 1=1`;

      if (query.status !== undefined) {
        params.push(query.status);
        sql += ` AND t.status = $${String(params.length)}`;
      }
      if (query.cursor !== undefined) {
        params.push(query.cursor);
        sql += `
           AND (t.created_at, t.id) < (
             SELECT t2.created_at, t2.id FROM tenants t2 WHERE t2.id = $${String(params.length)}::uuid
           )`;
      }
      sql += ` ORDER BY t.created_at DESC, t.id DESC LIMIT $1`;

      const result = await client.query(sql, params);
      const mapped = result.rows.map(mapListRow);
      if (mapped.length > query.limit) {
        const page = mapped.slice(0, query.limit);
        return { rows: page, nextCursor: page[page.length - 1]?.id ?? null };
      }
      return { rows: mapped, nextCursor: null };
    });
  }

  async getTenant(actorUserId: string, tenantId: string): Promise<PlatformTenantDetail | null> {
    if (!isUuid(tenantId) || this.platformPool === null) {
      return null;
    }
    return withPlatformTransaction(this.platformPool, { userId: actorUserId }, async (client) => {
      return loadDetail(client, tenantId);
    });
  }

  async registerTenant(
    actorUserId: string,
    input: RegisterTenantInput,
    correlationId: string,
  ): Promise<RegisterTenantResult> {
    if (this.platformPool === null) {
      throw new Error('platform store unavailable');
    }
    return withPlatformTransaction(this.platformPool, { userId: actorUserId }, async (client) => {
      const tenantId = randomUUID();
      await client.query(
        `INSERT INTO tenants (id, code, name, status, primary_locale, timezone, created_at, updated_at)
         VALUES ($1::uuid, $2, $3, 'active', $4, $5, now(), now())`,
        [tenantId, input.code, input.name, input.primaryLocale, input.timezone],
      );

      await client.query(
        `INSERT INTO tenant_settings (tenant_id, schema_version, settings, updated_at, updated_by_user_id)
         VALUES ($1::uuid, 1, '{}'::jsonb, now(), $2::uuid)
         ON CONFLICT (tenant_id) DO NOTHING`,
        [tenantId, actorUserId],
      );

      const existingUser = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE email = $1::citext LIMIT 1`,
        [input.ownerEmail],
      );

      let ownerUserId = existingUser.rows[0]?.id;
      let ownerCreated = false;
      if (ownerUserId === undefined) {
        ownerUserId = randomUUID();
        await client.query(
          `INSERT INTO users (
             id, email, email_verified_at, display_name, status, password_hash,
             external_subject_id, last_login_at, created_at, updated_at
           ) VALUES (
             $1::uuid, $2::citext, NULL, $3, 'invited', NULL,
             NULL, NULL, now(), now()
           )`,
          [ownerUserId, input.ownerEmail, input.ownerDisplayName],
        );
        ownerCreated = true;
      }

      await client.query(
        `INSERT INTO tenant_memberships (
           id, tenant_id, user_id, status, joined_at, created_at, updated_at
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, 'active', now(), now(), now()
         )
         ON CONFLICT (tenant_id, user_id) DO UPDATE
           SET status = 'active', updated_at = now()`,
        [randomUUID(), tenantId, ownerUserId],
      );

      // Dynamic import avoids an init cycle: identity barrel → AuthService → platform barrel → this module.
      const { bootstrapSystemRolesForTenant } = await import('../../identity-and-access/index.js');
      await bootstrapSystemRolesForTenant(client, {
        tenantId,
        assignUserId: ownerUserId,
        assignRoleCode: 'owner',
      });

      await insertAudit(client, {
        action: 'platform.tenant.register',
        actorUserId,
        tenantId,
        resourceId: tenantId,
        correlationId,
        metadata: { code: input.code, ownerEmail: input.ownerEmail },
      });

      const tenant = await loadDetail(client, tenantId);
      if (tenant === null) {
        throw new Error('registered tenant missing after insert');
      }
      return { tenant, ownerUserId, ownerCreated };
    });
  }

  async setTenantStatus(
    actorUserId: string,
    tenantId: string,
    nextStatus: 'suspended' | 'active',
    reason: string,
    correlationId: string,
  ): Promise<PlatformTenantDetail | null> {
    if (!isUuid(tenantId) || this.platformPool === null) {
      return null;
    }
    return withPlatformTransaction(this.platformPool, { userId: actorUserId }, async (client) => {
      const current = await client.query<{ status: string }>(
        `SELECT status FROM tenants WHERE id = $1::uuid LIMIT 1`,
        [tenantId],
      );
      const row = current.rows[0];
      if (row === undefined) {
        return null;
      }
      const expected = nextStatus === 'suspended' ? 'active' : 'suspended';
      if (row.status !== expected) {
        const err = new Error('invalid tenant status transition');
        (err as { code?: string }).code = 'INVALID_STATUS';
        (err as { currentStatus?: string }).currentStatus = row.status;
        throw err;
      }

      await client.query(
        `UPDATE tenants SET status = $2, updated_at = now() WHERE id = $1::uuid`,
        [tenantId, nextStatus],
      );
      await insertAudit(client, {
        action: nextStatus === 'suspended' ? 'platform.tenant.suspend' : 'platform.tenant.reinstate',
        actorUserId,
        tenantId,
        resourceId: tenantId,
        correlationId,
        metadata: { reason },
      });
      return loadDetail(client, tenantId);
    });
  }

  async listPlans(actorUserId: string): Promise<ReadonlyArray<PlatformPlanRow>> {
    if (this.platformPool === null) {
      return [];
    }
    return withPlatformTransaction(this.platformPool, { userId: actorUserId }, async (client) => {
      const result = await client.query<{
        id: string;
        code: string;
        name: string;
        status: string;
      }>(
        `SELECT id, code, name, status FROM plans ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, code`,
      );
      return result.rows;
    });
  }

  async assignPlan(
    actorUserId: string,
    tenantId: string,
    planCode: string,
    reason: string,
    correlationId: string,
  ): Promise<PlatformTenantDetail | null> {
    if (!isUuid(tenantId) || this.platformPool === null) {
      return null;
    }
    return withPlatformTransaction(this.platformPool, { userId: actorUserId }, async (client) => {
      const tenant = await client.query(`SELECT id FROM tenants WHERE id = $1::uuid LIMIT 1`, [tenantId]);
      if (tenant.rows[0] === undefined) {
        return null;
      }
      const plan = await client.query<{ id: string }>(
        `SELECT id FROM plans WHERE code = $1 LIMIT 1`,
        [planCode],
      );
      const planId = plan.rows[0]?.id;
      if (planId === undefined) {
        const err = new Error('plan not found');
        (err as { code?: string }).code = 'PLAN_NOT_FOUND';
        throw err;
      }

      await client.query(
        `UPDATE tenant_plan_assignments
            SET status = 'ended', ended_at = now()
          WHERE tenant_id = $1::uuid AND status = 'active'`,
        [tenantId],
      );
      await client.query(
        `INSERT INTO tenant_plan_assignments (
           id, tenant_id, plan_id, status, assigned_by, reason, assigned_at, ended_at
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'active', $4::uuid, $5, now(), NULL)`,
        [randomUUID(), tenantId, planId, actorUserId, reason],
      );
      await insertAudit(client, {
        action: 'platform.tenant.plan_assign',
        actorUserId,
        tenantId,
        resourceId: tenantId,
        correlationId,
        metadata: { planCode, reason },
      });
      return loadDetail(client, tenantId);
    });
  }

  async setEntitlement(
    actorUserId: string,
    tenantId: string,
    code: EntitlementCode,
    enabled: boolean,
    limit: number | null,
    reason: string,
    correlationId: string,
  ): Promise<PlatformTenantDetail | null> {
    if (!isUuid(tenantId) || this.platformPool === null) {
      return null;
    }
    return withPlatformTransaction(this.platformPool, { userId: actorUserId }, async (client) => {
      const tenant = await client.query(`SELECT id FROM tenants WHERE id = $1::uuid LIMIT 1`, [tenantId]);
      if (tenant.rows[0] === undefined) {
        return null;
      }
      await client.query(
        `INSERT INTO tenant_entitlements (
           id, tenant_id, code, enabled, limit_value, updated_by, created_at, updated_at
         ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid, now(), now())
         ON CONFLICT (tenant_id, code) DO UPDATE
           SET enabled = EXCLUDED.enabled,
               limit_value = EXCLUDED.limit_value,
               updated_by = EXCLUDED.updated_by,
               updated_at = now()`,
        [randomUUID(), tenantId, code, enabled, limit, actorUserId],
      );
      await insertAudit(client, {
        action: 'platform.tenant.entitlement_set',
        actorUserId,
        tenantId,
        resourceId: tenantId,
        correlationId,
        metadata: { code, enabled, limit, reason },
      });
      return loadDetail(client, tenantId);
    });
  }

  async listAudit(
    actorUserId: string,
    query: {
      readonly limit: number;
      readonly cursor: string | undefined;
      readonly tenantId: string | undefined;
      readonly action: string | undefined;
    },
  ): Promise<{ readonly rows: ReadonlyArray<PlatformAuditRow>; readonly nextCursor: string | null }> {
    if (this.platformPool === null) {
      return { rows: [], nextCursor: null };
    }
    return withPlatformTransaction(this.platformPool, { userId: actorUserId }, async (client) => {
      const params: unknown[] = [query.limit + 1];
      let sql = `
        SELECT id, occurred_at, action, outcome, actor_user_id, tenant_id, resource_type, resource_id
          FROM audit_events
         WHERE 1=1`;
      if (query.tenantId !== undefined) {
        params.push(query.tenantId);
        sql += ` AND tenant_id = $${String(params.length)}::uuid`;
      }
      if (query.action !== undefined) {
        params.push(query.action);
        sql += ` AND action = $${String(params.length)}`;
      }
      if (query.cursor !== undefined) {
        params.push(query.cursor);
        sql += `
           AND (occurred_at, id) < (
             SELECT a2.occurred_at, a2.id FROM audit_events a2 WHERE a2.id = $${String(params.length)}::uuid
           )`;
      }
      sql += ` ORDER BY occurred_at DESC, id DESC LIMIT $1`;
      const result = await client.query(sql, params);
      const mapped = result.rows.map(mapAuditRow);
      if (mapped.length > query.limit) {
        const page = mapped.slice(0, query.limit);
        return { rows: page, nextCursor: page[page.length - 1]?.id ?? null };
      }
      return { rows: mapped, nextCursor: null };
    });
  }
}

async function loadDetail(client: PoolClient, tenantId: string): Promise<PlatformTenantDetail | null> {
  const tenant = await client.query<{
    id: string;
    code: string;
    name: string;
    status: string;
    primary_locale: string;
    timezone: string;
    created_at: Date;
    updated_at: Date;
    plan_code: string | null;
  }>(
    `SELECT t.id, t.code, t.name, t.status, t.primary_locale, t.timezone,
            t.created_at, t.updated_at, p.code AS plan_code
       FROM tenants t
       LEFT JOIN tenant_plan_assignments a
         ON a.tenant_id = t.id AND a.status = 'active'
       LEFT JOIN plans p ON p.id = a.plan_id
      WHERE t.id = $1::uuid
      LIMIT 1`,
    [tenantId],
  );
  const row = tenant.rows[0];
  if (row === undefined) {
    return null;
  }
  const entitlements = await client.query<{
    code: string;
    enabled: boolean;
    limit_value: number | null;
  }>(
    `SELECT code, enabled, limit_value FROM tenant_entitlements WHERE tenant_id = $1::uuid ORDER BY code`,
    [tenantId],
  );
  return {
    ...mapListRow(row),
    entitlements: entitlements.rows.map((e) => ({
      code: e.code,
      enabled: e.enabled,
      limit: e.limit_value,
    })),
  };
}

function mapListRow(row: {
  id: string;
  code: string;
  name: string;
  status: string;
  primary_locale: string;
  timezone: string;
  created_at: Date | string;
  updated_at: Date | string;
  plan_code: string | null;
}): PlatformTenantListRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    primaryLocale: row.primary_locale,
    timezone: row.timezone,
    planCode: row.plan_code,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapAuditRow(row: {
  id: string;
  occurred_at: Date | string;
  action: string;
  outcome: string;
  actor_user_id: string | null;
  tenant_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
}): PlatformAuditRow {
  return {
    id: row.id,
    occurredAt: toIso(row.occurred_at),
    action: row.action,
    outcome: row.outcome,
    actorUserId: row.actor_user_id,
    tenantId: row.tenant_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
  };
}

async function insertAudit(
  client: PoolClient,
  input: {
    readonly action: string;
    readonly actorUserId: string;
    readonly tenantId: string | null;
    readonly resourceId: string;
    readonly correlationId: string;
    readonly metadata: Readonly<Record<string, unknown>>;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (
       id, occurred_at, action, outcome, correlation_id, actor_user_id,
       tenant_id, resource_type, resource_id, metadata
     ) VALUES (
       $1::uuid, now(), $2, 'success', $3, $4::uuid, $5::uuid, 'tenant', $6, $7::jsonb
     )`,
    [
      randomUUID(),
      input.action,
      input.correlationId,
      input.actorUserId,
      input.tenantId,
      input.resourceId,
      JSON.stringify(input.metadata),
    ],
  );
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
