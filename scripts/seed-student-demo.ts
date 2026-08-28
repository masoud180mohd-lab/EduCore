/**
 * Local / lab seed: student demo user + membership + student bind.
 *
 * Twin of seed-parent-demo. NOT for production.
 *
 * Prerequisites:
 *   1) npm run db:migrate
 *   2) npm run seed:admin
 *
 * Usage:
 *   $env:SEED_STUDENT_PASS='ChangeMe-Student-Local-1'
 *   npm run seed:student-demo
 *
 * Optional: SEED_STUDENT_EMAIL, SEED_STUDENT_RESET=1
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
import { SEED_ROLE_PARENT_ID } from './seed-parent-demo.js';

const { Client } = pg;

export const SEED_STUDENT_USER_ID = '01900000-0010-7000-8000-000000000030';
export const SEED_STUDENT_MEMBERSHIP_ID = '01900000-0010-7000-8000-000000000031';
export const SEED_STUDENT_PROFILE_ID = '01900000-0010-7000-8000-000000000032';
export const SEED_ROLE_STUDENT_ID = '01900000-0010-7000-8000-000000000033';
export const SEED_USER_ROLE_STUDENT_ID = '01900000-0010-7000-8000-000000000034';

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

export type SeedStudentDemoConfig = {
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

export function loadSeedStudentDemoConfig(
  environment: NodeJS.ProcessEnv = process.env,
): SeedStudentDemoConfig {
  const password =
    environment['SEED_STUDENT_PASS']?.trim() || environment['SEED_STUDENT_PASSWORD']?.trim() || '';
  if (password.length < 8) {
    throw new Error(
      'SEED_STUDENT_PASS is required and must be at least 8 characters (set in env, never commit).',
    );
  }

  const emailRaw = environment['SEED_STUDENT_EMAIL']?.trim() || 'student@educore.local';
  const email = emailRaw.toLowerCase();
  if (!email.includes('@') || email.length > 320) {
    throw new Error('SEED_STUDENT_EMAIL must be a valid email-shaped string.');
  }

  return {
    email,
    password,
    connectionString: resolvePlatformUrl(environment),
    appConnectionString: resolveAppUrl(environment),
    resetPassword: environment['SEED_STUDENT_RESET'] === '1',
    allowProduction: environment['SEED_ADMIN_ALLOW_PRODUCTION'] === '1',
    nodeEnv: environment['NODE_ENV']?.trim() || 'development',
    tenantId: SEED_TENANT_ID,
    actorUserId: SEED_USER_ID,
  };
}

export type SeedStudentDemoResult = {
  readonly tenantId: string;
  readonly studentUserId: string;
  readonly studentEmail: string;
  readonly studentId: string;
  readonly created: {
    readonly user: boolean;
    readonly student: boolean;
  };
  readonly passwordUpdated: boolean;
};

export async function seedStudentDemo(
  config: SeedStudentDemoConfig,
  clientFactory: () => pg.Client = () => new Client({ connectionString: config.connectionString }),
  appClientFactory: () => pg.Client = () =>
    new Client({ connectionString: config.appConnectionString }),
): Promise<SeedStudentDemoResult> {
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

  let studentUserId: string;
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
        student: SEED_ROLE_STUDENT_ID,
      },
    });

    const existingUser = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1::citext OR id = $2::uuid LIMIT 1`,
      [config.email, SEED_STUDENT_USER_ID],
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
        [SEED_STUDENT_USER_ID, config.email, 'Demo Student', passwordHash],
      );
      studentUserId = SEED_STUDENT_USER_ID;
      userCreated = true;
      passwordUpdated = true;
    } else {
      studentUserId = existingUser.rows[0].id;
      if (config.resetPassword) {
        await client.query(
          `UPDATE users
           SET password_hash = $1, status = 'active', display_name = 'Demo Student', updated_at = now()
           WHERE id = $2::uuid`,
          [passwordHash, studentUserId],
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
      [SEED_STUDENT_MEMBERSHIP_ID, config.tenantId, studentUserId],
    );

    await bootstrapSystemRolesForTenant(client, {
      tenantId: config.tenantId,
      assignUserId: studentUserId,
      assignRoleCode: 'student',
      roleIds: {
        owner: SEED_ROLE_OWNER_ID,
        admin: SEED_ROLE_ADMIN_ID,
        staff: SEED_ROLE_STAFF_ID,
        parent: SEED_ROLE_PARENT_ID,
        student: SEED_ROLE_STUDENT_ID,
      },
      userRoleId: SEED_USER_ROLE_STUDENT_ID,
    });

    const studentExists = await client.query(
      `SELECT 1 FROM students WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
      [SEED_STUDENT_PROFILE_ID, config.tenantId],
    );
    if ((studentExists.rowCount ?? 0) === 0) {
      await client.query(
        `INSERT INTO students (
           id, tenant_id, student_code, display_name, status, created_at, updated_at
         ) VALUES (
           $1::uuid, $2::uuid, 'DEMO-STU-SELF', 'Demo Portal Student', 'active', now(), now()
         )`,
        [SEED_STUDENT_PROFILE_ID, config.tenantId],
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
  try {
    await app.query('BEGIN');
    await app.query(`SELECT set_config('app.current_tenant', $1, true)`, [config.tenantId]);
    await app.query(`SELECT set_config('app.current_user', $1, true)`, [config.actorUserId]);
    await app.query(`SELECT set_config('app.rls_mode', 'tenant', true)`);
    await app.query(`SELECT set_config('app.is_platform_operator', 'false', true)`);

    await app.query(`SELECT * FROM app.bind_student_user($1::uuid, $2::uuid, $3::uuid, $4::uuid)`, [
      config.actorUserId,
      config.tenantId,
      SEED_STUDENT_PROFILE_ID,
      studentUserId,
    ]);

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
    studentUserId,
    studentEmail: config.email,
    studentId: SEED_STUDENT_PROFILE_ID,
    created: {
      user: userCreated,
      student: studentCreated,
    },
    passwordUpdated,
  };
}

async function main(): Promise<void> {
  const config = loadSeedStudentDemoConfig();
  process.stdout.write(
    'Seeding student demo (platform role; password redacted; connection url redacted).\n',
  );

  try {
    const result = await seedStudentDemo(config);
    process.stdout.write(
      [
        'Student demo seed complete.',
        `  studentEmail: ${result.studentEmail}`,
        `  studentUserId: ${result.studentUserId}`,
        `  tenantId: ${result.tenantId}`,
        `  studentId: ${result.studentId}`,
        `  created.user: ${String(result.created.user)}`,
        `  created.student: ${String(result.created.student)}`,
        `  passwordUpdated: ${String(result.passwordUpdated)}`,
        '',
        'Login as student → expect /t/{tenantId}/student',
        `  POST /api/v1/auth/login { "email": "${result.studentEmail}", "password": "<SEED_STUDENT_PASS>", "tenantId": "${result.tenantId}" }`,
      ].join('\n') + '\n',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'seed failed';
    process.stderr.write(`seed:student-demo failed: ${message.split('\n')[0] ?? 'unknown'}\n`);
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  void main();
}
