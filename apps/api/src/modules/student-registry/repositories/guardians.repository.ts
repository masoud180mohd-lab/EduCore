/**
 * Guardians + student_guardians (DBF-010 / ACF-010).
 * SELECT via RLS; writes via SECURITY DEFINER helpers.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type GuardianRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type StudentGuardianLinkRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly studentId: string;
  readonly guardianId: string;
  readonly relationshipType: string;
  readonly isPrimary: boolean;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

@Injectable()
export class GuardiansRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  async listForTenant(
    actorUserId: string,
    tenantId: string,
    query: {
      readonly limit: number;
      readonly cursor: string | undefined;
      readonly status: 'active' | 'inactive' | undefined;
      readonly search: string | undefined;
    },
  ): Promise<{ readonly rows: ReadonlyArray<GuardianRow>; readonly nextCursor: string | null }> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId, query.limit + 1];
          let sql = `
            SELECT g.id, g.tenant_id, g.display_name, g.phone, g.email, g.status,
                   g.created_at, g.updated_at
            FROM guardians g
            WHERE g.tenant_id = $1::uuid`;
          if (query.status !== undefined) {
            params.push(query.status);
            sql += ` AND g.status = $${String(params.length)}`;
          }
          if (query.search !== undefined) {
            params.push(query.search);
            sql += ` AND (
              g.display_name ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\'
              OR COALESCE(g.email, '') ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\'
            )`;
          }
          if (query.cursor !== undefined && isUuid(query.cursor)) {
            params.push(query.cursor);
            sql += ` AND (g.display_name, g.id) > (
              SELECT g2.display_name, g2.id FROM guardians g2
              WHERE g2.id = $${String(params.length)}::uuid AND g2.tenant_id = $1::uuid
            )`;
          }
          sql += ` ORDER BY g.display_name ASC, g.id ASC LIMIT $2`;
          const result = await client.query<DbGuardian>(sql, params);
          const mapped = result.rows.map((row) => mapGuardian(row));
          if (mapped.length > query.limit) {
            const page = mapped.slice(0, query.limit);
            return { rows: page, nextCursor: page[page.length - 1]?.id ?? null };
          }
          return { rows: mapped, nextCursor: null };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'GuardiansRepository', error, { operation: 'list' });
      return { rows: [], nextCursor: null };
    }
  }

  async getByIdForTenant(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
  ): Promise<GuardianRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(guardianId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<DbGuardian>(
            `SELECT id, tenant_id, display_name, phone, email, status, created_at, updated_at
             FROM guardians WHERE id = $1::uuid AND tenant_id = $2::uuid`,
            [guardianId, tenantId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapGuardian(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'GuardiansRepository', error, { operation: 'get' });
      return null;
    }
  }

  async createForTenant(
    actorUserId: string,
    tenantId: string,
    input: {
      readonly id: string;
      readonly displayName: string;
      readonly phone: string | null;
      readonly email: string | null;
      readonly status: string;
    },
  ): Promise<GuardianRow> {
    if (this.pool === null) {
      throw new Error('database unavailable');
    }
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      const result = await client.query<DbGuardian>(
        `SELECT id, tenant_id, display_name, phone, email, status, created_at, updated_at
         FROM app.create_guardian($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7)`,
        [
          actorUserId,
          tenantId,
          input.id,
          input.displayName,
          input.phone,
          input.email,
          input.status,
        ],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('create_guardian returned no row');
      return mapGuardian(row);
    });
  }

  async updateForTenant(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
    patch: {
      readonly setDisplayName: boolean;
      readonly displayName: string | null;
      readonly setPhone: boolean;
      readonly phone: string | null;
      readonly setEmail: boolean;
      readonly email: string | null;
      readonly setStatus: boolean;
      readonly status: string | null;
    },
  ): Promise<GuardianRow | null> {
    if (this.pool === null) return null;
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<DbGuardian>(
            `SELECT id, tenant_id, display_name, phone, email, status, created_at, updated_at
             FROM app.update_guardian(
              $1::uuid, $2::uuid, $3::uuid,
              $4, $5, $6, $7, $8, $9, $10, $11
            )`,
            [
              actorUserId,
              tenantId,
              guardianId,
              patch.setDisplayName,
              patch.displayName,
              patch.setPhone,
              patch.phone,
              patch.setEmail,
              patch.email,
              patch.setStatus,
              patch.status,
            ],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapGuardian(row);
        },
      );
    } catch (error: unknown) {
      if (pgCode(error) === 'P0002') return null;
      throw error;
    }
  }

  async listLinksForGuardian(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
  ): Promise<ReadonlyArray<StudentGuardianLinkRow>> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(guardianId) || this.pool === null) {
      return [];
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<DbLink>(
            `SELECT id, tenant_id, student_id, guardian_id, relationship_type, is_primary,
                    status, created_at, updated_at
             FROM student_guardians
             WHERE tenant_id = $1::uuid AND guardian_id = $2::uuid
             ORDER BY created_at DESC, id ASC`,
            [tenantId, guardianId],
          );
          return result.rows.map((row) => mapLink(row));
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'GuardiansRepository', error, {
        operation: 'listLinksForGuardian',
      });
      return [];
    }
  }

  async listLinksForStudent(
    actorUserId: string,
    tenantId: string,
    studentId: string,
  ): Promise<ReadonlyArray<StudentGuardianLinkRow>> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(studentId) || this.pool === null) {
      return [];
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<DbLink>(
            `SELECT id, tenant_id, student_id, guardian_id, relationship_type, is_primary,
                    status, created_at, updated_at
             FROM student_guardians
             WHERE tenant_id = $1::uuid AND student_id = $2::uuid
             ORDER BY created_at DESC, id ASC`,
            [tenantId, studentId],
          );
          return result.rows.map((row) => mapLink(row));
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'GuardiansRepository', error, {
        operation: 'listLinksForStudent',
      });
      return [];
    }
  }

  async createLinkForTenant(
    actorUserId: string,
    tenantId: string,
    input: {
      readonly id: string;
      readonly studentId: string;
      readonly guardianId: string;
      readonly relationshipType: string;
      readonly isPrimary: boolean;
    },
  ): Promise<StudentGuardianLinkRow> {
    if (this.pool === null) throw new Error('database unavailable');
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      const result = await client.query<DbLink>(
        `SELECT id, tenant_id, student_id, guardian_id, relationship_type, is_primary,
                status, created_at, updated_at
         FROM app.create_student_guardian_link(
          $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7
        )`,
        [
          actorUserId,
          tenantId,
          input.id,
          input.studentId,
          input.guardianId,
          input.relationshipType,
          input.isPrimary,
        ],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('create_student_guardian_link returned no row');
      return mapLink(row);
    });
  }

  async endLinkForTenant(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
    linkId: string,
  ): Promise<StudentGuardianLinkRow | null> {
    if (this.pool === null) return null;
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<DbLink>(
            `SELECT id, tenant_id, student_id, guardian_id, relationship_type, is_primary,
                    status, created_at, updated_at
             FROM app.end_student_guardian_link($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
            [actorUserId, tenantId, guardianId, linkId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapLink(row);
        },
      );
    } catch (error: unknown) {
      if (pgCode(error) === 'P0002') return null;
      throw error;
    }
  }
}

function pgCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const value = Reflect.get(error, 'code');
    return typeof value === 'string' ? value : '';
  }
  return '';
}

type DbGuardian = {
  id: string;
  tenant_id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

type DbLink = {
  id: string;
  tenant_id: string;
  student_id: string;
  guardian_id: string;
  relationship_type: string;
  is_primary: boolean;
  status: string;
  created_at: Date;
  updated_at: Date;
};

function mapGuardian(row: DbGuardian): GuardianRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    displayName: row.display_name,
    phone: row.phone,
    email: row.email,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapLink(row: DbLink): StudentGuardianLinkRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    guardianId: row.guardian_id,
    relationshipType: row.relationship_type,
    isPrimary: row.is_primary,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
