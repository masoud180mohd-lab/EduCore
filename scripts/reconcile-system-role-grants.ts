/**
 * Ops/migrator: reconcile system role_permissions to current TypeScript matrices.
 *
 * WHY: `bootstrapSystemRolesForTenant` (educore_platform) can only ADD grants.
 *      DELETE on role_permissions is revoked for platform (least privilege).
 *      When matrices shrink, run this under DATABASE_URL (migrator/superuser).
 *
 * NEVER point Nest educore_app credentials here — DELETE will fail (by design).
 *
 * Usage (repo root):
 *   # one tenant
 *   npm run rbac:reconcile-grants -- --tenant-id=01900000-0010-7000-8000-000000000001
 *
 *   # all tenants that already have system roles
 *   npm run rbac:reconcile-grants -- --all-tenants
 *
 * Optional: DATABASE_URL (same defaults as db:migrate).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { reconcileSystemRoleGrantsForTenant } from '../apps/api/src/modules/identity-and-access/rbac/system-role-grant-reconcile.js';
import { isUuid } from '../apps/api/src/common/tenant/tenant-context.js';

const { Client } = pg;

function resolveDatabaseUrl(): string {
  const fromEnv = process.env['DATABASE_URL'];
  if (fromEnv !== undefined && fromEnv.trim() !== '') {
    return fromEnv.trim();
  }
  const user = process.env['POSTGRES_USER'] ?? 'educore';
  const password = process.env['POSTGRES_PASSWORD'] ?? 'educore_local_only';
  const host = process.env['POSTGRES_HOST'] ?? '127.0.0.1';
  const port = process.env['POSTGRES_HOST_PORT'] ?? process.env['POSTGRES_PORT'] ?? '5432';
  const database = process.env['POSTGRES_DB'] ?? 'educore';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function parseArgs(argv: ReadonlyArray<string>): {
  readonly tenantId: string | null;
  readonly allTenants: boolean;
} {
  let tenantId: string | null = null;
  let allTenants = false;
  for (const arg of argv) {
    if (arg === '--all-tenants') {
      allTenants = true;
      continue;
    }
    if (arg.startsWith('--tenant-id=')) {
      tenantId = arg.slice('--tenant-id='.length).trim();
    }
  }
  return { tenantId, allTenants };
}

async function main(): Promise<void> {
  const { tenantId, allTenants } = parseArgs(process.argv.slice(2));
  if (!allTenants && (tenantId === null || tenantId === '')) {
    throw new Error('Pass --tenant-id=<uuid> or --all-tenants');
  }
  if (tenantId !== null && tenantId !== '' && !isUuid(tenantId)) {
    throw new Error('--tenant-id must be a UUID');
  }

  const client = new Client({ connectionString: resolveDatabaseUrl() });
  await client.connect();
  try {
    await client.query('BEGIN');

    let targets: string[] = [];
    if (allTenants) {
      const rows = await client.query<{ id: string }>(
        `SELECT DISTINCT r.tenant_id AS id
         FROM roles r
         WHERE r.is_system = true
         ORDER BY r.tenant_id`,
      );
      targets = rows.rows.map((r) => r.id);
    } else if (tenantId !== null) {
      targets = [tenantId];
    }

    if (targets.length === 0) {
      console.log('No tenants with system roles found; nothing to reconcile.');
      await client.query('COMMIT');
      return;
    }

    for (const id of targets) {
      const result = await reconcileSystemRoleGrantsForTenant(
        {
          query: async (sql, params) => {
            const result = await client.query(sql, params === undefined ? [] : [...params]);
            return { rows: result.rows as Array<Record<string, unknown>> };
          },
        },
        { tenantId: id },
      );
      for (const role of result.roles) {
        console.log(
          JSON.stringify({
            tenantId: result.tenantId,
            role: role.code,
            removed: role.removedCodes,
            added: role.addedCodes,
          }),
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Reconciled ${String(targets.length)} tenant(s).`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
