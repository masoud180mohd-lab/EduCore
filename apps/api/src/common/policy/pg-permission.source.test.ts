import { describe, expect, it, vi } from 'vitest';

import type { Pool, PoolClient, QueryResult } from 'pg';

import { PgPermissionSource } from './pg-permission.source.js';

const USER_A = '11111111-1111-4111-8111-111111111111';
const TENANT_A = '22222222-2222-4222-8222-222222222222';

function mockPool(handler: (sql: string, params?: unknown[]) => unknown): Pool {
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
  return {
    connect: vi.fn(() => Promise.resolve(client as unknown as PoolClient)),
  } as unknown as Pool;
}

describe('PgPermissionSource', () => {
  it('returns empty set when pool is absent', async () => {
    const source = new PgPermissionSource(null);
    await expect(source.getPermissions(USER_A, TENANT_A)).resolves.toEqual(new Set());
  });

  it('returns empty set for invalid UUIDs without querying', async () => {
    const pool = mockPool(() => {
      throw new Error('should not query');
    });
    const source = new PgPermissionSource(pool);
    await expect(source.getPermissions('bad', TENANT_A)).resolves.toEqual(new Set());
  });

  it('loads distinct codes from app.user_permission_codes', async () => {
    const sqlLog: string[] = [];
    const pool = mockPool((sql) => {
      sqlLog.push(sql);
      if (sql.includes('user_permission_codes')) {
        return {
          rows: [{ code: 'tenant.read' }, { code: 'user.read' }],
          rowCount: 2,
          command: 'SELECT',
          oid: 0,
          fields: [],
        };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    const source = new PgPermissionSource(pool);
    await expect(source.getPermissions(USER_A, TENANT_A)).resolves.toEqual(
      new Set(['tenant.read', 'user.read']),
    );
    expect(sqlLog.some((s) => s.includes('user_permission_codes'))).toBe(true);
    expect(sqlLog.some((s) => s.includes('COMMIT'))).toBe(true);
  });

  it('fails closed on database errors', async () => {
    const pool = mockPool(() => {
      throw new Error('boom');
    });
    const source = new PgPermissionSource(pool);
    await expect(source.getPermissions(USER_A, TENANT_A)).resolves.toEqual(new Set());
  });
});
