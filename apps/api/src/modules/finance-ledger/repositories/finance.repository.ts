/**
 * Fee structures + invoices (IMP-009 / DBF-012). SELECT via RLS with derived
 * `balanceMinor` (sum of active invoice_lines minus sum of active
 * payment_allocations); writes via SECURITY DEFINER helpers
 * (app.create_fee_structure, app.create_invoice_draft, app.issue_invoice).
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

/** ACF-012 FeeStructure allowlist. */
export type FeeStructureRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly academicYearId: string;
  readonly name: string;
  readonly status: string;
  readonly currency: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** ACF-012 FeeStructureItem allowlist. */
export type FeeStructureItemRow = {
  readonly id: string;
  readonly feeStructureId: string;
  readonly name: string;
  readonly amountMinor: number;
  readonly sortOrder: number;
};

/** ACF-012 Invoice allowlist (voidedAt / issueJournalEntryId are internal-only). */
export type InvoiceRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly studentId: string;
  readonly academicYearId: string;
  readonly feeStructureId: string | null;
  readonly status: string;
  readonly currency: string;
  readonly totalMinor: number;
  readonly balanceMinor: number;
  readonly issuedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** ACF-012 InvoiceLine allowlist. */
export type InvoiceLineRow = {
  readonly id: string;
  readonly invoiceId: string;
  readonly description: string;
  readonly amountMinor: number;
  readonly feeStructureItemId: string | null;
};

export type ListFeeStructuresQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
  readonly academicYearId: string | undefined;
  readonly status: string | undefined;
};

export type ListInvoicesQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
  readonly studentId: string | undefined;
  readonly academicYearId: string | undefined;
  readonly status: string | undefined;
};

export type CreateFeeStructureItemInput = {
  readonly id: string;
  readonly name: string;
  readonly amountMinor: number;
  readonly sortOrder: number;
};

export type CreateFeeStructureInput = {
  readonly id: string;
  readonly academicYearId: string;
  readonly name: string;
  readonly status: string;
  readonly currency: string;
  readonly items: ReadonlyArray<CreateFeeStructureItemInput>;
};

export type UpdateFeeStructureInput = {
  readonly setName: boolean;
  readonly name: string | null;
  readonly setStatus: boolean;
  readonly status: string | null;
  readonly setItems: boolean;
  readonly items: ReadonlyArray<CreateFeeStructureItemInput> | null;
};

export type CreateInvoiceLineInput = {
  readonly id: string;
  readonly description: string;
  readonly amountMinor: number;
  readonly feeStructureItemId: string | null;
};

export type CreateInvoiceDraftInput = {
  readonly id: string;
  readonly studentId: string;
  readonly academicYearId: string;
  readonly feeStructureId: string | null;
  readonly lines: ReadonlyArray<CreateInvoiceLineInput>;
};

type FeeStructureDbRow = {
  id: string;
  tenant_id: string;
  academic_year_id: string;
  name: string;
  status: string;
  currency: string;
  created_at: Date;
  updated_at: Date;
};

type FeeStructureItemDbRow = {
  id: string;
  fee_structure_id: string;
  name: string;
  amount_minor: string | number;
  sort_order: number;
};

type InvoiceDbRow = {
  id: string;
  tenant_id: string;
  student_id: string;
  academic_year_id: string;
  fee_structure_id: string | null;
  status: string;
  currency: string;
  total_minor: string | number;
  balance_minor: string | number;
  issued_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type InvoiceLineDbRow = {
  id: string;
  invoice_id: string;
  description: string;
  amount_minor: string | number;
  fee_structure_item_id: string | null;
};

/**
 * balanceMinor is always derived, never stored (DBF-012). A voided invoice
 * reports balance 0 — nothing is owed once a void's reversing journal has
 * posted, even though its (necessarily zero) active allocations would
 * already compute to the same result; the CASE makes that policy explicit.
 */
const INVOICE_COMPUTED_SELECT = `
  SELECT i.id, i.tenant_id, i.student_id, i.academic_year_id, i.fee_structure_id, i.status,
         i.currency, i.issued_at, i.created_at, i.updated_at,
         COALESCE((
           SELECT SUM(il.amount_minor) FROM invoice_lines il
           WHERE il.invoice_id = i.id AND il.tenant_id = i.tenant_id
         ), 0) AS total_minor,
         CASE WHEN i.status = 'void' THEN 0 ELSE
           COALESCE((
             SELECT SUM(il.amount_minor) FROM invoice_lines il
             WHERE il.invoice_id = i.id AND il.tenant_id = i.tenant_id
           ), 0) - COALESCE((
             SELECT SUM(pal.amount_minor) FROM payment_allocations pal
             WHERE pal.invoice_id = i.id AND pal.tenant_id = i.tenant_id AND pal.status = 'active'
           ), 0)
         END AS balance_minor
  FROM invoices i`;

@Injectable()
export class FinanceRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  async listFeeStructures(
    actorUserId: string,
    tenantId: string,
    query: ListFeeStructuresQuery,
  ): Promise<{
    readonly rows: ReadonlyArray<FeeStructureRow>;
    readonly nextCursor: string | null;
  }> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }
    if (query.cursor !== undefined && !isUuid(query.cursor)) {
      return { rows: [], nextCursor: null };
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId, query.limit + 1];
          let sql = `
            SELECT fs.id, fs.tenant_id, fs.academic_year_id, fs.name, fs.status, fs.currency,
                   fs.created_at, fs.updated_at
            FROM fee_structures fs
            WHERE fs.tenant_id = $1::uuid`;
          if (query.academicYearId !== undefined) {
            params.push(query.academicYearId);
            sql += ` AND fs.academic_year_id = $${String(params.length)}::uuid`;
          }
          if (query.status !== undefined) {
            params.push(query.status);
            sql += ` AND fs.status = $${String(params.length)}`;
          }
          if (query.cursor !== undefined) {
            params.push(query.cursor);
            sql += `
              AND EXISTS (
                SELECT 1 FROM fee_structures cur
                WHERE cur.id = $${String(params.length)}::uuid AND cur.tenant_id = $1::uuid
                  AND (
                    fs.created_at < cur.created_at
                    OR (fs.created_at = cur.created_at AND fs.id > cur.id)
                  )
              )`;
          }
          sql += ` ORDER BY fs.created_at DESC, fs.id ASC LIMIT $2`;
          const result = await client.query<FeeStructureDbRow>(sql, params);
          const hasMore = result.rows.length > query.limit;
          const page = hasMore ? result.rows.slice(0, query.limit) : result.rows;
          const mapped = page.map(mapFeeStructure);
          const last = mapped[mapped.length - 1];
          return { rows: mapped, nextCursor: hasMore && last !== undefined ? last.id : null };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'FinanceRepository', error, {
        operation: 'listFeeStructures',
      });
      return { rows: [], nextCursor: null };
    }
  }

  async getFeeStructure(
    actorUserId: string,
    tenantId: string,
    feeStructureId: string,
  ): Promise<FeeStructureRow | null> {
    if (
      !isUuid(actorUserId) ||
      !isUuid(tenantId) ||
      !isUuid(feeStructureId) ||
      this.pool === null
    ) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<FeeStructureDbRow>(
            `SELECT id, tenant_id, academic_year_id, name, status, currency, created_at, updated_at
             FROM fee_structures WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
            [tenantId, feeStructureId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapFeeStructure(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'FinanceRepository', error, {
        operation: 'getFeeStructure',
      });
      return null;
    }
  }

  async listFeeStructureItems(
    actorUserId: string,
    tenantId: string,
    feeStructureId: string,
  ): Promise<ReadonlyArray<FeeStructureItemRow>> {
    if (
      !isUuid(actorUserId) ||
      !isUuid(tenantId) ||
      !isUuid(feeStructureId) ||
      this.pool === null
    ) {
      return [];
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<FeeStructureItemDbRow>(
            `SELECT id, fee_structure_id, name, amount_minor, sort_order
             FROM fee_structure_items
             WHERE tenant_id = $1::uuid AND fee_structure_id = $2::uuid
             ORDER BY sort_order ASC, id ASC`,
            [tenantId, feeStructureId],
          );
          return result.rows.map(mapFeeStructureItem);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'FinanceRepository', error, {
        operation: 'listFeeStructureItems',
      });
      return [];
    }
  }

  async createFeeStructure(
    actorUserId: string,
    tenantId: string,
    input: CreateFeeStructureInput,
  ): Promise<FeeStructureRow> {
    if (this.pool === null) throw new Error('database unavailable');
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      const result = await client.query<FeeStructureDbRow>(
        `SELECT id, tenant_id, academic_year_id, name, status, currency, created_at, updated_at
         FROM app.create_fee_structure($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8::jsonb)`,
        [
          actorUserId,
          tenantId,
          input.id,
          input.academicYearId,
          input.name,
          input.status,
          input.currency,
          JSON.stringify(
            input.items.map((item) => ({
              id: item.id,
              name: item.name,
              amountMinor: item.amountMinor,
              sortOrder: item.sortOrder,
            })),
          ),
        ],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('create_fee_structure returned no row');
      return mapFeeStructure(row);
    });
  }

  async updateFeeStructure(
    actorUserId: string,
    tenantId: string,
    feeStructureId: string,
    input: UpdateFeeStructureInput,
  ): Promise<FeeStructureRow | null> {
    if (this.pool === null) throw new Error('database unavailable');
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      const result = await client.query<FeeStructureDbRow>(
        `SELECT id, tenant_id, academic_year_id, name, status, currency, created_at, updated_at
         FROM app.update_fee_structure(
           $1::uuid, $2::uuid, $3::uuid, $4::boolean, $5::text,
           $6::boolean, $7::text, $8::boolean, $9::jsonb
         )`,
        [
          actorUserId,
          tenantId,
          feeStructureId,
          input.setName,
          input.name,
          input.setStatus,
          input.status,
          input.setItems,
          input.items === null
            ? null
            : JSON.stringify(
                input.items.map((item) => ({
                  id: item.id,
                  name: item.name,
                  amountMinor: item.amountMinor,
                  sortOrder: item.sortOrder,
                })),
              ),
        ],
      );
      const row = result.rows[0];
      return row === undefined ? null : mapFeeStructure(row);
    });
  }

  async listInvoices(
    actorUserId: string,
    tenantId: string,
    query: ListInvoicesQuery,
  ): Promise<{ readonly rows: ReadonlyArray<InvoiceRow>; readonly nextCursor: string | null }> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }
    if (query.cursor !== undefined && !isUuid(query.cursor)) {
      return { rows: [], nextCursor: null };
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId, query.limit + 1];
          let sql = `${INVOICE_COMPUTED_SELECT} WHERE i.tenant_id = $1::uuid`;
          if (query.studentId !== undefined) {
            params.push(query.studentId);
            sql += ` AND i.student_id = $${String(params.length)}::uuid`;
          }
          if (query.academicYearId !== undefined) {
            params.push(query.academicYearId);
            sql += ` AND i.academic_year_id = $${String(params.length)}::uuid`;
          }
          if (query.status !== undefined) {
            params.push(query.status);
            sql += ` AND i.status = $${String(params.length)}`;
          }
          if (query.cursor !== undefined) {
            params.push(query.cursor);
            sql += `
              AND EXISTS (
                SELECT 1 FROM invoices cur
                WHERE cur.id = $${String(params.length)}::uuid AND cur.tenant_id = $1::uuid
                  AND (
                    i.created_at < cur.created_at
                    OR (i.created_at = cur.created_at AND i.id > cur.id)
                  )
              )`;
          }
          sql += ` ORDER BY i.created_at DESC, i.id ASC LIMIT $2`;
          const result = await client.query<InvoiceDbRow>(sql, params);
          const hasMore = result.rows.length > query.limit;
          const page = hasMore ? result.rows.slice(0, query.limit) : result.rows;
          const mapped = page.map(mapInvoice);
          const last = mapped[mapped.length - 1];
          return { rows: mapped, nextCursor: hasMore && last !== undefined ? last.id : null };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'FinanceRepository', error, { operation: 'listInvoices' });
      return { rows: [], nextCursor: null };
    }
  }

  async getInvoiceWithLines(
    actorUserId: string,
    tenantId: string,
    invoiceId: string,
  ): Promise<{
    readonly invoice: InvoiceRow;
    readonly lines: ReadonlyArray<InvoiceLineRow>;
  } | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(invoiceId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const invoice = await this.fetchComputedInvoice(client, tenantId, invoiceId);
          if (invoice === null) return null;
          const lines = await this.fetchInvoiceLines(client, tenantId, invoiceId);
          return { invoice, lines };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'FinanceRepository', error, {
        operation: 'getInvoiceWithLines',
      });
      return null;
    }
  }

  async createInvoiceDraft(
    actorUserId: string,
    tenantId: string,
    input: CreateInvoiceDraftInput,
  ): Promise<InvoiceRow> {
    if (this.pool === null) throw new Error('database unavailable');
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      await client.query(
        `SELECT * FROM app.create_invoice_draft($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::jsonb)`,
        [
          actorUserId,
          tenantId,
          input.id,
          input.studentId,
          input.academicYearId,
          input.feeStructureId,
          JSON.stringify(
            input.lines.map((line) => ({
              id: line.id,
              description: line.description,
              amountMinor: line.amountMinor,
              feeStructureItemId: line.feeStructureItemId,
            })),
          ),
        ],
      );
      const row = await this.fetchComputedInvoice(client, tenantId, input.id);
      if (row === null) throw new Error('create_invoice_draft returned no row');
      return row;
    });
  }

  async issueInvoice(
    actorUserId: string,
    tenantId: string,
    invoiceId: string,
  ): Promise<InvoiceRow> {
    if (this.pool === null) throw new Error('database unavailable');
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      await client.query(`SELECT * FROM app.issue_invoice($1::uuid, $2::uuid, $3::uuid)`, [
        actorUserId,
        tenantId,
        invoiceId,
      ]);
      const row = await this.fetchComputedInvoice(client, tenantId, invoiceId);
      if (row === null) throw new Error('issue_invoice returned no row');
      return row;
    });
  }

  /** Wave D / DBF-012 rev 1.1: reverses the issue journal and marks the invoice void. */
  async voidInvoice(actorUserId: string, tenantId: string, invoiceId: string): Promise<InvoiceRow> {
    if (this.pool === null) throw new Error('database unavailable');
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      await client.query(`SELECT * FROM app.void_invoice($1::uuid, $2::uuid, $3::uuid)`, [
        actorUserId,
        tenantId,
        invoiceId,
      ]);
      const row = await this.fetchComputedInvoice(client, tenantId, invoiceId);
      if (row === null) throw new Error('void_invoice returned no row');
      return row;
    });
  }

  async summarizeInvoices(
    actorUserId: string,
    tenantId: string,
  ): Promise<{
    readonly issuedCount: number;
    readonly paidCount: number;
    readonly partiallyPaidCount: number;
    readonly outstandingMinor: number;
    readonly collectedMinor: number;
    readonly overdueCount: number;
  }> {
    const empty = {
      issuedCount: 0,
      paidCount: 0,
      partiallyPaidCount: 0,
      outstandingMinor: 0,
      collectedMinor: 0,
      overdueCount: 0,
    };
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) return empty;
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const counts = await client.query<{ status: string; n: string }>(
            `SELECT i.status, COUNT(*)::text AS n
             FROM invoices i
             WHERE i.tenant_id = $1::uuid AND i.status IN ('issued', 'partially_paid', 'paid')
             GROUP BY i.status`,
            [tenantId],
          );
          let issuedCount = 0;
          let paidCount = 0;
          let partiallyPaidCount = 0;
          for (const row of counts.rows) {
            const n = Number(row.n);
            if (row.status === 'issued') issuedCount = n;
            if (row.status === 'paid') paidCount = n;
            if (row.status === 'partially_paid') partiallyPaidCount = n;
          }
          const money = await client.query<{ outstanding: string; collected: string }>(
            `SELECT
               COALESCE(SUM(CASE WHEN i.status IN ('issued', 'partially_paid') THEN
                 COALESCE((SELECT SUM(il.amount_minor) FROM invoice_lines il
                   WHERE il.invoice_id = i.id AND il.tenant_id = i.tenant_id), 0)
                 - COALESCE((SELECT SUM(pal.amount_minor) FROM payment_allocations pal
                   WHERE pal.invoice_id = i.id AND pal.tenant_id = i.tenant_id AND pal.status = 'active'), 0)
               ELSE 0 END), 0)::text AS outstanding,
               COALESCE((
                 SELECT SUM(pal.amount_minor) FROM payment_allocations pal
                 WHERE pal.tenant_id = $1::uuid AND pal.status = 'active'
               ), 0)::text AS collected
             FROM invoices i
             WHERE i.tenant_id = $1::uuid`,
            [tenantId],
          );
          const overdue = await client.query<{ n: string }>(
            `SELECT COUNT(*)::text AS n
             FROM invoices i
             WHERE i.tenant_id = $1::uuid
               AND i.status IN ('issued', 'partially_paid')
               AND i.issued_at IS NOT NULL
               AND i.issued_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '30 days'`,
            [tenantId],
          );
          return {
            issuedCount,
            paidCount,
            partiallyPaidCount,
            outstandingMinor: Number(money.rows[0]?.outstanding ?? 0),
            collectedMinor: Number(money.rows[0]?.collected ?? 0),
            overdueCount: Number(overdue.rows[0]?.n ?? 0),
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'FinanceRepository', error, { operation: 'summarize' });
      return empty;
    }
  }

  private async fetchComputedInvoice(
    client: PoolClient,
    tenantId: string,
    invoiceId: string,
  ): Promise<InvoiceRow | null> {
    const result = await client.query<InvoiceDbRow>(
      `${INVOICE_COMPUTED_SELECT} WHERE i.tenant_id = $1::uuid AND i.id = $2::uuid LIMIT 1`,
      [tenantId, invoiceId],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapInvoice(row);
  }

  private async fetchInvoiceLines(
    client: PoolClient,
    tenantId: string,
    invoiceId: string,
  ): Promise<ReadonlyArray<InvoiceLineRow>> {
    const result = await client.query<InvoiceLineDbRow>(
      `SELECT id, invoice_id, description, amount_minor, fee_structure_item_id
       FROM invoice_lines
       WHERE tenant_id = $1::uuid AND invoice_id = $2::uuid
       ORDER BY created_at ASC, id ASC`,
      [tenantId, invoiceId],
    );
    return result.rows.map(mapInvoiceLine);
  }
}

function mapFeeStructure(row: FeeStructureDbRow): FeeStructureRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    academicYearId: row.academic_year_id,
    name: row.name,
    status: row.status,
    currency: row.currency,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapFeeStructureItem(row: FeeStructureItemDbRow): FeeStructureItemRow {
  return {
    id: row.id,
    feeStructureId: row.fee_structure_id,
    name: row.name,
    amountMinor: Number(row.amount_minor),
    sortOrder: row.sort_order,
  };
}

function mapInvoice(row: InvoiceDbRow): InvoiceRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    academicYearId: row.academic_year_id,
    feeStructureId: row.fee_structure_id,
    status: row.status,
    currency: row.currency,
    totalMinor: Number(row.total_minor),
    balanceMinor: Number(row.balance_minor),
    issuedAt: row.issued_at === null ? null : row.issued_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapInvoiceLine(row: InvoiceLineDbRow): InvoiceLineRow {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    description: row.description,
    amountMinor: Number(row.amount_minor),
    feeStructureItemId: row.fee_structure_item_id,
  };
}
