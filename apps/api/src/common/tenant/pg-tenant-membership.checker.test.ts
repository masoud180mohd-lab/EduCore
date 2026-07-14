import { describe, expect, it, vi } from 'vitest';

import type { Pool, PoolClient, QueryResult } from 'pg';

import { withTenantTransaction } from '../persistence/tenant-transaction.js';
import { PgTenantMembershipChecker } from './pg-tenant-membership.checker.js';

const USER_A = '11111111-1111-4111-8111-111111111111';
const TENANT_A = '22222222-2222-4222-8222-222222222222';
const TENANT_B = '33333333-3333-4333-8333-333333333333';

function mockPool(handler: (sql: string, params?: unknown[]) => unknown): {
  pool: Pool;
  connectMock: ReturnType<typeof vi.fn>;
} {
  const client = {
    query: vi.fn((sql: string, params?: unknown[]) => {
      const value = handler(sql, params);
      if (typeof value === 'object' && value !== null && 'rows' in value) {
        return Promise.resolve(value as QueryResult);
      }
      return Promise.resolve({
        rows: [],
        rowCount: 0,
        command: '',
        oid: 0,
        fields: [],
      } satisfies QueryResult);
    }),
    release: vi.fn(),
  };

  const connectMock = vi.fn(() => Promise.resolve(client as unknown as PoolClient));
  const pool = { connect: connectMock } as unknown as Pool;
  return { pool, connectMock };
}

describe('PgTenantMembershipChecker', () => {
  it('returns false when pool is absent (fail-closed)', async () => {
    const checker = new PgTenantMembershipChecker(null);
    await expect(checker.hasActiveMembership(USER_A, TENANT_A)).resolves.toBe(false);
  });

  it('returns false for non-UUID inputs without querying', async () => {
    const { pool, connectMock } = mockPool(() => {
      throw new Error('should not query');
    });
    const checker = new PgTenantMembershipChecker(pool);
    await expect(checker.hasActiveMembership('not-a-uuid', TENANT_A)).resolves.toBe(false);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('queries app.user_has_active_membership inside a tenant transaction', async () => {
    const sqlLog: string[] = [];
    const { pool } = mockPool((sql) => {
      sqlLog.push(sql);
      if (sql.includes('user_has_active_membership')) {
        return { rows: [{ ok: true }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    const checker = new PgTenantMembershipChecker(pool);
    await expect(checker.hasActiveMembership(USER_A, TENANT_A)).resolves.toBe(true);

    expect(sqlLog.some((s) => s.includes('BEGIN'))).toBe(true);
    expect(sqlLog.some((s) => s.includes("set_config('app.current_tenant'"))).toBe(true);
    expect(sqlLog.some((s) => s.includes("set_config('app.current_user'"))).toBe(true);
    expect(sqlLog.some((s) => s.includes('user_has_active_membership'))).toBe(true);
    expect(sqlLog.some((s) => s.includes('COMMIT'))).toBe(true);
  });

  it('returns false and fails closed when the database errors', async () => {
    const { pool } = mockPool(() => {
      throw new Error('connection refused');
    });
    const checker = new PgTenantMembershipChecker(pool);
    await expect(checker.hasActiveMembership(USER_A, TENANT_B)).resolves.toBe(false);
  });
});

describe('withTenantTransaction', () => {
  it('releases the client after commit', async () => {
    const release = vi.fn();
    const statements: string[] = [];
    const query = vi.fn((sql: string) => {
      statements.push(sql);
      return Promise.resolve({
        rows: [],
        rowCount: 0,
        command: '',
        oid: 0,
        fields: [],
      });
    });
    const pool = {
      connect: vi.fn(() => Promise.resolve({ query, release }) as unknown as Promise<PoolClient>),
    } as unknown as Pool;

    const value = await withTenantTransaction(pool, { userId: USER_A, tenantId: TENANT_A }, () =>
      Promise.resolve(42),
    );
    expect(value).toBe(42);
    expect(release).toHaveBeenCalledOnce();
    expect(statements.some((s) => s.includes('COMMIT'))).toBe(true);
  });
});
