/**
 * Local / lab seed: create one active tenant + admin user + membership.
 *
 * Uses `educore_platform` + trusted platform GUCs (same trust model as AUDIT-R2 inserts).
 * Password is hashed with the same scrypt format as Nest login (P3).
 *
 * NOT for production. Blocked when NODE_ENV=production unless SEED_ADMIN_ALLOW_PRODUCTION=1.
 *
 * Usage (from repo root):
 *   $env:SEED_ADMIN_PASS='ChangeMe-Local-Only-1'
 *   npm run seed:admin
 *
 * Optional env: SEED_ADMIN_EMAIL, SEED_TENANT_CODE, SEED_TENANT_NAME,
 *   SEED_PLATFORM_DATABASE_URL (preferred), DATABASE_URL (operator grant; migrator/ops),
 *   SEED_ADMIN_RESET=1
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { hashPassword } from '../apps/api/src/modules/identity-and-access/auth/password-hasher.js';
import { bootstrapSystemRolesForTenant } from '../apps/api/src/modules/identity-and-access/rbac/system-role-bootstrap.js';

const { Client } = pg;

/** Stable local UUIDs so re-runs are predictable (not secrets). */
export const SEED_TENANT_ID = '01900000-0010-7000-8000-000000000001';
export const SEED_USER_ID = '01900000-0010-7000-8000-000000000002';
export const SEED_MEMBERSHIP_ID = '01900000-0010-7000-8000-000000000003';
export const SEED_ROLE_OWNER_ID = '01900000-0010-7000-8000-000000000010';
export const SEED_ROLE_ADMIN_ID = '01900000-0010-7000-8000-000000000011';
export const SEED_ROLE_STAFF_ID = '01900000-0010-7000-8000-000000000012';
export const SEED_USER_ROLE_OWNER_ID = '01900000-0010-7000-8000-000000000013';

export type SeedAdminConfig = {
  readonly email: string;
  readonly password: string;
  readonly tenantCode: string;
  readonly tenantName: string;
  readonly connectionString: string;
  /** Migrator/ops URL for `platform_operators` (educore_platform cannot INSERT). */
  readonly migratorConnectionString: string;
  readonly resetPassword: boolean;
  readonly allowProduction: boolean;
  readonly nodeEnv: string;
};

export function loadSeedAdminConfig(environment: NodeJS.ProcessEnv = process.env): SeedAdminConfig {
  const password =
    environment['SEED_ADMIN_PASS']?.trim() || environment['SEED_ADMIN_PASSWORD']?.trim() || '';
  if (password.length < 8) {
    throw new Error(
      'SEED_ADMIN_PASS is required and must be at least 8 characters (set in env, never commit).',
    );
  }

  const emailRaw = environment['SEED_ADMIN_EMAIL']?.trim() || 'admin@educore.local';
  const email = emailRaw.toLowerCase();
  if (!email.includes('@') || email.length > 320) {
    throw new Error('SEED_ADMIN_EMAIL must be a valid email-shaped string.');
  }

  const tenantCode = environment['SEED_TENANT_CODE']?.trim() || 'demo-school';
  if (!/^[a-z0-9-]{3,64}$/.test(tenantCode)) {
    throw new Error('SEED_TENANT_CODE must match ^[a-z0-9-]{3,64}$.');
  }

  const tenantName = environment['SEED_TENANT_NAME']?.trim() || 'Demo School';
  if (tenantName.length < 1 || tenantName.length > 200) {
    throw new Error('SEED_TENANT_NAME must be 1–200 characters.');
  }

  return {
    email,
    password,
    tenantCode,
    tenantName,
    connectionString: resolvePlatformUrl(environment),
    migratorConnectionString: resolveMigratorUrl(environment),
    resetPassword: environment['SEED_ADMIN_RESET'] === '1',
    allowProduction: environment['SEED_ADMIN_ALLOW_PRODUCTION'] === '1',
    nodeEnv: environment['NODE_ENV']?.trim() || 'development',
  };
}

function resolvePlatformUrl(environment: NodeJS.ProcessEnv): string {
  const explicit = environment['SEED_PLATFORM_DATABASE_URL']?.trim();
  if (explicit !== undefined && explicit !== '') {
    return explicit;
  }

  // Prefer platform role (required for RLS-compliant INSERT). Not educore_app.
  const user = environment['SEED_PLATFORM_USER'] ?? 'educore_platform';
  const password = environment['SEED_PLATFORM_PASSWORD'] ?? 'educore_platform_local_only';
  const host = environment['POSTGRES_HOST'] ?? '127.0.0.1';
  const port = environment['POSTGRES_HOST_PORT'] ?? environment['POSTGRES_PORT'] ?? '5432';
  const database = environment['POSTGRES_DB'] ?? 'educore';

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function resolveMigratorUrl(environment: NodeJS.ProcessEnv): string {
  const explicit = environment['DATABASE_URL']?.trim();
  if (explicit !== undefined && explicit !== '') {
    return explicit;
  }

  const user = environment['POSTGRES_USER'] ?? 'educore';
  const password = environment['POSTGRES_PASSWORD'] ?? 'educore_local_only';
  const host = environment['POSTGRES_HOST'] ?? '127.0.0.1';
  const port = environment['POSTGRES_HOST_PORT'] ?? environment['POSTGRES_PORT'] ?? '5432';
  const database = environment['POSTGRES_DB'] ?? 'educore';

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export function assertSeedAllowed(config: SeedAdminConfig): void {
  if (config.nodeEnv === 'production' && !config.allowProduction) {
    throw new Error(
      'Refusing to seed admin when NODE_ENV=production (set SEED_ADMIN_ALLOW_PRODUCTION=1 only for break-glass labs).',
    );
  }
}

export type SeedAdminResult = {
  readonly tenantId: string;
  readonly userId: string;
  readonly email: string;
  readonly tenantCode: string;
  readonly created: {
    readonly tenant: boolean;
    readonly user: boolean;
    readonly membership: boolean;
    readonly platformOperator: boolean;
  };
  readonly passwordUpdated: boolean;
  readonly rbac: {
    readonly roles: ReadonlyArray<string>;
    readonly assignedRole: string | null;
  };
};

/**
 * Idempotent seed under a trusted platform transaction.
 * Does not log passwords or password hashes.
 */
export async function seedLocalAdmin(
  config: SeedAdminConfig,
  clientFactory: () => pg.Client = () => new Client({ connectionString: config.connectionString }),
): Promise<SeedAdminResult> {
  assertSeedAllowed(config);

  const passwordHash = await hashPassword(config.password);
  const client = clientFactory();

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.is_platform_operator', 'true', true)`);
    await client.query(`SELECT set_config('app.rls_mode', 'bootstrap', true)`);

    const existingTenant = await client.query<{ id: string }>(
      `SELECT id FROM tenants WHERE id = $1::uuid OR code = $2 LIMIT 1`,
      [SEED_TENANT_ID, config.tenantCode],
    );

    let tenantId = existingTenant.rows[0]?.id;
    let tenantCreated = false;

    if (tenantId === undefined) {
      await client.query(
        `INSERT INTO tenants (id, code, name, status, primary_locale, timezone, created_at, updated_at)
         VALUES ($1::uuid, $2, $3, 'active', 'en', 'Africa/Dar_es_Salaam', now(), now())`,
        [SEED_TENANT_ID, config.tenantCode, config.tenantName],
      );
      tenantId = SEED_TENANT_ID;
      tenantCreated = true;
    } else {
      await client.query(
        `UPDATE tenants
         SET name = $1, status = 'active', updated_at = now()
         WHERE id = $2::uuid`,
        [config.tenantName, tenantId],
      );
    }

    const existingUser = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1::citext OR id = $2::uuid LIMIT 1`,
      [config.email, SEED_USER_ID],
    );

    let userId = existingUser.rows[0]?.id;
    let userCreated = false;
    let passwordUpdated = false;

    if (userId === undefined) {
      await client.query(
        `INSERT INTO users (
           id, email, email_verified_at, display_name, status, password_hash,
           external_subject_id, last_login_at, created_at, updated_at
         ) VALUES (
           $1::uuid, $2::citext, now(), $3, 'active', $4,
           NULL, NULL, now(), now()
         )`,
        [SEED_USER_ID, config.email, 'Local Admin', passwordHash],
      );
      userId = SEED_USER_ID;
      userCreated = true;
      passwordUpdated = true;
    } else if (config.resetPassword) {
      await client.query(
        `UPDATE users
         SET password_hash = $1, status = 'active', updated_at = now()
         WHERE id = $2::uuid`,
        [passwordHash, userId],
      );
      passwordUpdated = true;
    }

    const membershipInserted = await client.query(
      `INSERT INTO tenant_memberships (
         id, tenant_id, user_id, status, joined_at, created_at, updated_at
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, 'active', now(), now(), now()
       )
       ON CONFLICT (tenant_id, user_id) DO UPDATE
         SET status = 'active', updated_at = now()
       RETURNING id`,
      [SEED_MEMBERSHIP_ID, tenantId, userId],
    );

    // IMP-001 P4: system roles + assign owner so PolicyEvaluator has real codes.
    const rbac = await bootstrapSystemRolesForTenant(client, {
      tenantId,
      assignUserId: userId,
      assignRoleCode: 'owner',
      roleIds: {
        owner: SEED_ROLE_OWNER_ID,
        admin: SEED_ROLE_ADMIN_ID,
        staff: SEED_ROLE_STAFF_ID,
      },
      userRoleId: SEED_USER_ROLE_OWNER_ID,
    });

    await client.query('COMMIT');

    const platformOperatorGranted = await grantPlatformOperator(
      config.migratorConnectionString,
      userId,
    );

    return {
      tenantId,
      userId,
      email: config.email,
      tenantCode: config.tenantCode,
      created: {
        tenant: tenantCreated,
        user: userCreated,
        membership: (membershipInserted.rowCount ?? 0) > 0,
        platformOperator: platformOperatorGranted,
      },
      passwordUpdated,
      rbac: {
        roles: rbac.roles.map((r) => r.code),
        assignedRole: rbac.assigned?.roleCode ?? null,
      },
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw error;
  } finally {
    await client.end();
  }
}

async function grantPlatformOperator(
  migratorConnectionString: string,
  userId: string,
): Promise<boolean> {
  const client = new Client({ connectionString: migratorConnectionString });
  await client.connect();
  try {
    const result = await client.query(
      `INSERT INTO platform_operators (user_id, role, status, granted_by, created_at, updated_at)
       VALUES ($1::uuid, 'super_admin', 'active', $1::uuid, now(), now())
       ON CONFLICT (user_id) DO UPDATE
         SET status = 'active',
             role = 'super_admin',
             updated_at = now()`,
      [userId],
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const config = loadSeedAdminConfig();
  process.stdout.write(
    'Seeding local admin (platform role; password redacted; connection url redacted).\n',
  );

  try {
    const result = await seedLocalAdmin(config);
    process.stdout.write(
      [
        'Seed complete.',
        `  email: ${result.email}`,
        `  userId: ${result.userId}`,
        `  tenantId: ${result.tenantId}`,
        `  tenantCode: ${result.tenantCode}`,
        `  created.tenant: ${String(result.created.tenant)}`,
        `  created.user: ${String(result.created.user)}`,
        `  created.platformOperator: ${String(result.created.platformOperator)}`,
        `  passwordUpdated: ${String(result.passwordUpdated)}`,
        `  rbac.roles: ${result.rbac.roles.join(', ')}`,
        `  rbac.assignedRole: ${result.rbac.assignedRole ?? 'none'}`,
        '',
        'Login (API): POST /api/v1/auth/login',
        `  body: { "email": "${result.email}", "password": "<SEED_ADMIN_PASS>", "tenantId": "${result.tenantId}" }`,
        "  or omit tenantId if this is the user's only active membership.",
        '  Then GET /api/v1/auth/me → data.roles + data.permissions (when tenant bound).',
        '',
        'Runtime pool must be educore_app (EDUCORE_APP_DATABASE_URL / EDUCORE_ENABLE_APP_DB=1).',
      ].join('\n') + '\n',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'seed failed';
    // Never echo connection strings or passwords.
    process.stderr.write(`seed:admin failed: ${message.split('\n')[0] ?? 'unknown'}\n`);
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  void main();
}
