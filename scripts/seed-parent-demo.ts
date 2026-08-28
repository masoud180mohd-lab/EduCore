/**
 * Local / lab seed: parent demo user + membership + guardian bind + student link.
 *
 * Twin of seed-local-admin (platform GUCs). NOT for production.
 *
 * Prerequisites:
 *   1) npm run db:migrate
 *   2) npm run seed:admin  (same tenant; provides actor membership for helpers)
 *   3) Optional: npm run rbac:reconcile-grants -- --all-tenants
 *      (needs migrator/superuser DATABASE_URL — not educore_app)
 *
 * Usage:
 *   $env:SEED_PARENT_PASS='ChangeMe-Parent-Local-1'
 *   npm run seed:parent-demo
 *
 * Optional: SEED_PARENT_EMAIL, SEED_ADMIN_PASS (only if admin missing — prefer seed:admin first),
 *   SEED_PLATFORM_DATABASE_URL, EDUCORE_APP_DATABASE_URL, SEED_PARENT_RESET=1
 *
 * Invoice creation: use bursar Fees UI (IMP-010) for the seeded student — this script
 * does not invent ledger posts.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { hashPassword } from '../apps/api/src/modules/identity-and-access/auth/password-hasher.js';
import { bootstrapSystemRolesForTenant } from '../apps/api/src/modules/identity-and-access/rbac/system-role-bootstrap.js';
import {
  SEED_ROLE_ADMIN_ID,
  SEED_ROLE_OWNER_ID,
  SEED_ROLE_STAFF_ID,
  SEED_TENANT_ID,
  SEED_USER_ID,
  assertSeedAllowed,
} from './seed-local-admin.js';

const { Client } = pg;

export const SEED_PARENT_USER_ID = '01900000-0010-7000-8000-000000000020';
export const SEED_PARENT_MEMBERSHIP_ID = '01900000-0010-7000-8000-000000000021';
export const SEED_PARENT_GUARDIAN_ID = '01900000-0010-7000-8000-000000000022';
export const SEED_PARENT_STUDENT_ID = '01900000-0010-7000-8000-000000000023';
export const SEED_PARENT_LINK_ID = '01900000-0010-7000-8000-000000000024';
export const SEED_ROLE_PARENT_ID = '01900000-0010-7000-8000-000000000025';
export const SEED_USER_ROLE_PARENT_ID = '01900000-0010-7000-8000-000000000026';

function resolvePlatformUrl(environment: NodeJS.ProcessEnv): string {
  const explicit = environment['SEED_PLATFORM_DATABASE_URL']?.trim();
  if (explicit !== undefined && explicit !== '') {
    return explicit;
  }
  const user = environment['SEED_PLATFORM_USER'] ?? 'educore_platform';
  const password = environment['SEED_PLATFORM_PASSWORD'] ?? 'educore_platform_local_only';
  const host = environment['POSTGRES_HOST'] ?? '127.0.0.1';
  const port = environment['POSTGRES_HOST_PORT'] ?? environment['POSTGRES_PORT'] ?? '5432';
  const database = environment['POSTGRES_DB'] ?? 'educore';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

/** educore_app pool — required for SECURITY DEFINER guardian helpers (no platform INSERT RLS). */
function resolveAppUrl(environment: NodeJS.ProcessEnv): string {
  const explicit = environment['EDUCORE_APP_DATABASE_URL']?.trim();
  if (explicit !== undefined && explicit !== '') {
    return explicit;
  }
  const user = environment['SEED_APP_USER'] ?? 'educore_app';
  const password = environment['SEED_APP_PASSWORD'] ?? 'educore_app_local_only';
  const host = environment['POSTGRES_HOST'] ?? '127.0.0.1';
  const port = environment['POSTGRES_HOST_PORT'] ?? environment['POSTGRES_PORT'] ?? '5432';
  const database = environment['POSTGRES_DB'] ?? 'educore';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export type SeedParentDemoConfig = {
  readonly email: string;
  readonly password: string;
  readonly connectionString: string;
  readonly appConnectionString: string;
  readonly resetPassword: boolean;
  readonly allowProduction: boolean;
  readonly nodeEnv: string;
  readonly tenantId: string;
  readonly actorUserId: string;
};

export function loadSeedParentDemoConfig(
  environment: NodeJS.ProcessEnv = process.env,
): SeedParentDemoConfig {
  const password =
    environment['SEED_PARENT_PASS']?.trim() || environment['SEED_PARENT_PASSWORD']?.trim() || '';
  if (password.length < 8) {
    throw new Error(
      'SEED_PARENT_PASS is required and must be at least 8 characters (set in env, never commit).',
    );
  }

  const emailRaw = environment['SEED_PARENT_EMAIL']?.trim() || 'parent@educore.local';
  const email = emailRaw.toLowerCase();
  if (!email.includes('@') || email.length > 320) {
    throw new Error('SEED_PARENT_EMAIL must be a valid email-shaped string.');
  }

  return {
    email,
    password,
    connectionString: resolvePlatformUrl(environment),
    appConnectionString: resolveAppUrl(environment),
    resetPassword: environment['SEED_PARENT_RESET'] === '1',
    allowProduction: environment['SEED_ADMIN_ALLOW_PRODUCTION'] === '1',
    nodeEnv: environment['NODE_ENV']?.trim() || 'development',
    tenantId: SEED_TENANT_ID,
    actorUserId: SEED_USER_ID,
  };
}

export type SeedParentDemoResult = {
  readonly tenantId: string;
  readonly parentUserId: string;
  readonly parentEmail: string;
  readonly guardianId: string;
  readonly studentId: string;
  readonly linkId: string;
  readonly created: {
    readonly user: boolean;
    readonly guardian: boolean;
    readonly student: boolean;
    readonly link: boolean;
  };
  readonly passwordUpdated: boolean;
};

export async function seedParentDemo(
  config: SeedParentDemoConfig,
  clientFactory: () => pg.Client = () => new Client({ connectionString: config.connectionString }),
  appClientFactory: () => pg.Client = () =>
    new Client({ connectionString: config.appConnectionString }),
): Promise<SeedParentDemoResult> {
  assertSeedAllowed({
    email: config.email,
    password: config.password,
    tenantCode: 'demo-school',
    tenantName: 'Demo School',
    connectionString: config.connectionString,
    migratorConnectionString: config.connectionString,
    resetPassword: config.resetPassword,
    allowProduction: config.allowProduction,
    nodeEnv: config.nodeEnv,
  });

  const passwordHash = await hashPassword(config.password);
  const client = clientFactory();
  await client.connect();

  let parentUserId: string;
  let userCreated = false;
  let passwordUpdated = false;
  let studentCreated = false;

  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.is_platform_operator', 'true', true)`);
    await client.query(`SELECT set_config('app.rls_mode', 'bootstrap', true)`);

    const tenant = await client.query<{ id: string }>(
      `SELECT id FROM tenants WHERE id = $1::uuid LIMIT 1`,
      [config.tenantId],
    );
    if (tenant.rows[0] === undefined) {
      throw new Error(
        `Tenant ${config.tenantId} missing. Run npm run seed:admin first (same lab tenant).`,
      );
    }

    const actorMembership = await client.query(
      `SELECT 1 FROM tenant_memberships
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND status = 'active'
       LIMIT 1`,
      [config.tenantId, config.actorUserId],
    );
    if ((actorMembership.rowCount ?? 0) === 0) {
      throw new Error(
        `Admin actor ${config.actorUserId} has no active membership. Run npm run seed:admin first.`,
      );
    }

    await bootstrapSystemRolesForTenant(client, {
      tenantId: config.tenantId,
      roleIds: {
        owner: SEED_ROLE_OWNER_ID,
        admin: SEED_ROLE_ADMIN_ID,
        staff: SEED_ROLE_STAFF_ID,
        parent: SEED_ROLE_PARENT_ID,
      },
    });

    const existingUser = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1::citext OR id = $2::uuid LIMIT 1`,
      [config.email, SEED_PARENT_USER_ID],
    );

    if (existingUser.rows[0] === undefined) {
      await client.query(
        `INSERT INTO users (
           id, email, email_verified_at, display_name, status, password_hash,
           external_subject_id, last_login_at, created_at, updated_at
         ) VALUES (
           $1::uuid, $2::citext, now(), $3, 'active', $4,
           NULL, NULL, now(), now()
         )`,
        [SEED_PARENT_USER_ID, config.email, 'Demo Parent', passwordHash],
      );
      parentUserId = SEED_PARENT_USER_ID;
      userCreated = true;
      passwordUpdated = true;
    } else {
      parentUserId = existingUser.rows[0].id;
      if (config.resetPassword) {
        await client.query(
          `UPDATE users
           SET password_hash = $1, status = 'active', display_name = 'Demo Parent', updated_at = now()
           WHERE id = $2::uuid`,
          [passwordHash, parentUserId],
        );
        passwordUpdated = true;
      }
    }

    await client.query(
      `INSERT INTO tenant_memberships (
         id, tenant_id, user_id, status, joined_at, created_at, updated_at
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, 'active', now(), now(), now()
       )
       ON CONFLICT (tenant_id, user_id) DO UPDATE
         SET status = 'active', updated_at = now()`,
      [SEED_PARENT_MEMBERSHIP_ID, config.tenantId, parentUserId],
    );

    await bootstrapSystemRolesForTenant(client, {
      tenantId: config.tenantId,
      assignUserId: parentUserId,
      assignRoleCode: 'parent',
      roleIds: {
        owner: SEED_ROLE_OWNER_ID,
        admin: SEED_ROLE_ADMIN_ID,
        staff: SEED_ROLE_STAFF_ID,
        parent: SEED_ROLE_PARENT_ID,
      },
      userRoleId: SEED_USER_ROLE_PARENT_ID,
    });

    const studentExists = await client.query(
      `SELECT 1 FROM students WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
      [SEED_PARENT_STUDENT_ID, config.tenantId],
    );
    if ((studentExists.rowCount ?? 0) === 0) {
      await client.query(
        `INSERT INTO students (
           id, tenant_id, student_code, display_name, status, created_at, updated_at
         ) VALUES (
           $1::uuid, $2::uuid, 'DEMO-PARENT-STU', 'Demo Linked Student', 'active', now(), now()
         )`,
        [SEED_PARENT_STUDENT_ID, config.tenantId],
      );
      studentCreated = true;
    }

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    await client.end();
    throw error;
  }
  await client.end();

  const app = appClientFactory();
  await app.connect();
  let guardianCreated = false;
  let linkCreated = false;
  try {
    await app.query('BEGIN');
    await app.query(`SELECT set_config('app.current_tenant', $1, true)`, [config.tenantId]);
    await app.query(`SELECT set_config('app.current_user', $1, true)`, [config.actorUserId]);
    await app.query(`SELECT set_config('app.rls_mode', 'tenant', true)`);
    await app.query(`SELECT set_config('app.is_platform_operator', 'false', true)`);

    const guardianExists = await app.query(
      `SELECT 1 FROM guardians WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
      [SEED_PARENT_GUARDIAN_ID, config.tenantId],
    );
    if ((guardianExists.rowCount ?? 0) === 0) {
      await app.query(
        `SELECT * FROM app.create_guardian(
          $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7
        )`,
        [
          config.actorUserId,
          config.tenantId,
          SEED_PARENT_GUARDIAN_ID,
          'Demo Parent Guardian',
          null,
          config.email,
          'active',
        ],
      );
      guardianCreated = true;
    }

    await app.query(
      `SELECT * FROM app.bind_guardian_user($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
      [config.actorUserId, config.tenantId, SEED_PARENT_GUARDIAN_ID, parentUserId],
    );

    const linkExists = await app.query(
      `SELECT 1 FROM student_guardians
       WHERE tenant_id = $1::uuid
         AND student_id = $2::uuid
         AND guardian_id = $3::uuid
         AND status = 'active'
       LIMIT 1`,
      [config.tenantId, SEED_PARENT_STUDENT_ID, SEED_PARENT_GUARDIAN_ID],
    );
    if ((linkExists.rowCount ?? 0) === 0) {
      await app.query(
        `SELECT * FROM app.create_student_guardian_link(
          $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7
        )`,
        [
          config.actorUserId,
          config.tenantId,
          SEED_PARENT_LINK_ID,
          SEED_PARENT_STUDENT_ID,
          SEED_PARENT_GUARDIAN_ID,
          'guardian',
          true,
        ],
      );
      linkCreated = true;
    }

    await app.query('COMMIT');
  } catch (error) {
    try {
      await app.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw error;
  } finally {
    await app.end();
  }

  return {
    tenantId: config.tenantId,
    parentUserId,
    parentEmail: config.email,
    guardianId: SEED_PARENT_GUARDIAN_ID,
    studentId: SEED_PARENT_STUDENT_ID,
    linkId: SEED_PARENT_LINK_ID,
    created: {
      user: userCreated,
      guardian: guardianCreated,
      student: studentCreated,
      link: linkCreated,
    },
    passwordUpdated,
  };
}

async function main(): Promise<void> {
  const config = loadSeedParentDemoConfig();
  process.stdout.write(
    'Seeding parent demo (platform role; password redacted; connection url redacted).\n',
  );

  try {
    const result = await seedParentDemo(config);
    process.stdout.write(
      [
        'Parent demo seed complete.',
        `  parentEmail: ${result.parentEmail}`,
        `  parentUserId: ${result.parentUserId}`,
        `  tenantId: ${result.tenantId}`,
        `  guardianId: ${result.guardianId}`,
        `  studentId: ${result.studentId}`,
        `  created.user: ${String(result.created.user)}`,
        `  created.guardian: ${String(result.created.guardian)}`,
        `  created.student: ${String(result.created.student)}`,
        `  created.link: ${String(result.created.link)}`,
        `  passwordUpdated: ${String(result.passwordUpdated)}`,
        '',
        'Login as parent → expect /t/{tenantId}/parent',
        `  POST /api/v1/auth/login { "email": "${result.parentEmail}", "password": "<SEED_PARENT_PASS>", "tenantId": "${result.tenantId}" }`,
        '',
        'Next: as bursar, open Fees UI and issue an invoice for the seeded studentId.',
        'MoMo / parent pay remain blocked (PAY-PROVIDER-001).',
      ].join('\n') + '\n',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'seed failed';
    process.stderr.write(`seed:parent-demo failed: ${message.split('\n')[0] ?? 'unknown'}\n`);
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  void main();
}
