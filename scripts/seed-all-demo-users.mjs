import { randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto';
import pg from 'pg';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;
const PREFIX = 'scrypt';

function scryptAsync(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, derivedKey) => {
      if (err !== null) return reject(err);
      resolve(derivedKey);
    });
  });
}

async function hashPassword(password) {
  const salt = randomBytes(SALT_LEN);
  const key = await scryptAsync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return [
    PREFIX,
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

const ALL_PERMISSIONS = [
  'tenant.read',
  'tenant.manage',
  'organization.read',
  'organization.manage',
  'user.invite',
  'user.read',
  'user.manage',
  'role.read',
  'role.manage',
  'session.revoke',
  'audit.read',
  'entitlement.read',
  'entitlement.manage',
  'student.read',
  'student.manage',
  'academic.read',
  'academic.manage',
  'attendance.read',
  'attendance.manage',
  'guardian.read',
  'guardian.manage',
  'marks.read',
  'marks.manage',
  'marks.approve',
  'finance.read',
  'finance.manage',
  'finance.reconcile',
  'notification.read',
  'notification.manage',
  'ai.read',
  'ai.manage',
  'parent.guardian.read',
  'parent.finance.read',
  'student.self.read',
];

const SYSTEM_ROLES = [
  { code: 'owner', name: 'School Owner', permissions: ALL_PERMISSIONS },
  { code: 'admin', name: 'School Admin', permissions: ALL_PERMISSIONS.filter((p) => p !== 'entitlement.manage') },
  {
    code: 'staff',
    name: 'General Staff',
    permissions: [
      'tenant.read',
      'organization.read',
      'user.read',
      'student.read',
      'academic.read',
      'attendance.read',
      'attendance.manage',
      'guardian.read',
      'marks.read',
      'marks.manage',
      'notification.read',
      'notification.manage',
      'ai.read',
      'ai.manage',
      'role.read',
      'audit.read',
      'entitlement.read',
    ],
  },
  {
    code: 'teacher',
    name: 'Teacher',
    permissions: [
      'tenant.read',
      'organization.read',
      'student.read',
      'academic.read',
      'attendance.read',
      'attendance.manage',
      'marks.read',
      'marks.manage',
    ],
  },
  {
    code: 'head_teacher',
    name: 'Head Teacher',
    permissions: [
      'tenant.read',
      'organization.read',
      'student.read',
      'academic.read',
      'attendance.read',
      'attendance.manage',
      'marks.read',
      'marks.manage',
      'marks.approve',
      'finance.read',
    ],
  },
  {
    code: 'bursar',
    name: 'Bursar',
    permissions: [
      'tenant.read',
      'organization.read',
      'student.read',
      'academic.read',
      'guardian.read',
      'finance.read',
      'finance.manage',
    ],
  },
  {
    code: 'parent',
    name: 'Parent',
    permissions: ['parent.guardian.read', 'parent.finance.read'],
  },
  {
    code: 'student',
    name: 'Student',
    permissions: ['student.self.read'],
  },
];

const SEED_TENANT_ID = '01900000-0010-7000-8000-000000000001';
const DEMO_PASSWORD = 'Password123!';

async function main() {
  const client = new pg.Client({
    connectionString: 'postgresql://postgres:educore_local_only@127.0.0.1:5432/educore',
  });

  await client.connect();
  console.log('Connected to DB as postgres superuser.');

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_platform_operator', 'true', true)");
    await client.query("SELECT set_config('app.rls_mode', 'bootstrap', true)");

    // 1. Tenant
    await client.query(
      `INSERT INTO tenants (id, code, name, status, primary_locale, timezone, created_at, updated_at)
       VALUES ($1::uuid, 'demo-school', 'Demo School', 'active', 'en', 'Africa/Dar_es_Salaam', now(), now())
       ON CONFLICT (id) DO UPDATE SET status = 'active', name = 'Demo School', updated_at = now()`,
      [SEED_TENANT_ID],
    );

    // 2. Roles & Permissions binding

    for (const r of SYSTEM_ROLES) {
      await client.query(
        `INSERT INTO roles (id, tenant_id, code, name, is_system, created_at, updated_at)
         VALUES (gen_random_uuid(), $1::uuid, $2, $3, true, now(), now())
         ON CONFLICT (tenant_id, code) DO UPDATE SET name = $3, updated_at = now()`,
        [SEED_TENANT_ID, r.code, r.name],
      );

      const roleRes = await client.query(
        'SELECT id FROM roles WHERE tenant_id = $1::uuid AND code = $2',
        [SEED_TENANT_ID, r.code],
      );
      const roleId = roleRes.rows[0]?.id;

      for (const pCode of r.permissions) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id, created_at)
           SELECT $1::uuid, p.id, now() FROM permissions p WHERE p.code = $2
           ON CONFLICT (role_id, permission_id) DO NOTHING`,
          [roleId, pCode],
        );
      }
    }

    // 3. Demo Users
    const passwordHash = await hashPassword(DEMO_PASSWORD);

    const usersList = [
      {
        id: '01900000-0010-7000-8000-000000000002',
        email: 'admin@educore.local',
        displayName: 'Local Administrator',
        roles: ['owner', 'admin'],
      },
      {
        id: '01900000-0010-7000-8000-000000000004',
        email: 'head@educore.local',
        displayName: 'Mwalimu Mkuu (Head Teacher)',
        roles: ['head_teacher', 'staff', 'teacher'],
      },
      {
        id: '01900000-0010-7000-8000-000000000005',
        email: 'teacher@educore.local',
        displayName: 'Mwalimu Juma (Teacher)',
        roles: ['teacher', 'staff'],
      },
      {
        id: '01900000-0010-7000-8000-000000000020',
        email: 'parent@educore.local',
        displayName: 'Amina Salum (Parent)',
        roles: ['parent'],
      },
      {
        id: '01900000-0010-7000-8000-000000000030',
        email: 'student@educore.local',
        displayName: 'Rashid Bakari (Student)',
        roles: ['student'],
      },
    ];

    for (const u of usersList) {
      await client.query(
        `INSERT INTO users (
           id, email, email_verified_at, display_name, status, password_hash, created_at, updated_at
         ) VALUES (
           $1::uuid, $2::citext, now(), $3, 'active', $4, now(), now()
         )
         ON CONFLICT (id) DO UPDATE
           SET password_hash = $4, status = 'active', display_name = $3, updated_at = now()`,
        [u.id, u.email, u.displayName, passwordHash],
      );

      // Membership
      await client.query(
        `INSERT INTO tenant_memberships (id, tenant_id, user_id, status, joined_at, created_at, updated_at)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'active', now(), now(), now())
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active', updated_at = now()`,
        [SEED_TENANT_ID, u.id],
      );

      // Assign user roles
      for (const roleCode of u.roles) {
        const roleRes = await client.query(
          `SELECT id FROM roles WHERE tenant_id = $1::uuid AND code = $2 LIMIT 1`,
          [SEED_TENANT_ID, roleCode],
        );
        const roleId = roleRes.rows[0]?.id;
        if (roleId) {
          const exists = await client.query(
            `SELECT 1 FROM user_roles WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND role_id = $3::uuid LIMIT 1`,
            [SEED_TENANT_ID, u.id, roleId],
          );
          if ((exists.rowCount ?? 0) === 0) {
            await client.query(
              `INSERT INTO user_roles (id, tenant_id, user_id, role_id, created_at)
               VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, now())`,
              [SEED_TENANT_ID, u.id, roleId],
            );
          }
        }
      }
    }

    // 4. Platform Super Admin Operator (for admin@educore.local)
    try {
      const opsClient = new pg.Client({
        connectionString: 'postgresql://postgres:educore_local_only@127.0.0.1:5432/educore',
      });
      await opsClient.connect();
      await opsClient.query(
        `INSERT INTO platform_operators (user_id, role, status, granted_by, created_at, updated_at)
         VALUES ($1::uuid, 'super_admin', 'active', $1::uuid, now(), now())
         ON CONFLICT (user_id) DO UPDATE SET status = 'active', role = 'super_admin', updated_at = now()`,
        ['01900000-0010-7000-8000-000000000002'],
      );
      await opsClient.end();
      console.log('Platform operator super_admin granted to admin@educore.local.');
    } catch (e) {
      console.log('Platform operator note:', e.message);
    }

    // 5. Seed Demo Student Profile
    const STUDENT_PROFILE_ID = '01900000-0010-7000-8000-000000000032';
    await client.query(
      `INSERT INTO students (id, tenant_id, student_code, display_name, status, user_id, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, 'STU-2026-001', 'Rashid Bakari', 'active', $3::uuid, now(), now())
       ON CONFLICT (id) DO UPDATE SET display_name = 'Rashid Bakari', status = 'active', user_id = $3::uuid, updated_at = now()`,
      [STUDENT_PROFILE_ID, SEED_TENANT_ID, '01900000-0010-7000-8000-000000000030'],
    );

    // 6. Seed Demo Guardian Profile & Link to Parent User
    const GUARDIAN_ID = '01900000-0010-7000-8000-000000000022';
    await client.query(
      `INSERT INTO guardians (id, tenant_id, display_name, email, status, user_id, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, 'Amina Salum', 'parent@educore.local', 'active', $3::uuid, now(), now())
       ON CONFLICT (id) DO UPDATE SET display_name = 'Amina Salum', status = 'active', user_id = $3::uuid, updated_at = now()`,
      [GUARDIAN_ID, SEED_TENANT_ID, '01900000-0010-7000-8000-000000000020'],
    );

    // Link Guardian to Student
    const linkExists = await client.query(
      `SELECT 1 FROM student_guardians WHERE tenant_id = $1::uuid AND student_id = $2::uuid AND guardian_id = $3::uuid AND status = 'active' LIMIT 1`,
      [SEED_TENANT_ID, STUDENT_PROFILE_ID, GUARDIAN_ID],
    );
    if ((linkExists.rowCount ?? 0) === 0) {
      await client.query(
        `INSERT INTO student_guardians (id, tenant_id, student_id, guardian_id, relationship_type, is_primary, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'mother', true, 'active', now(), now())`,
        [SEED_TENANT_ID, STUDENT_PROFILE_ID, GUARDIAN_ID],
      );
    }

    await client.query('COMMIT');
    console.log('\n======================================================');
    console.log('✅ ALL DEMO PORTAL USERS & DATA SEEDED SUCCESSFULLY!');
    console.log('======================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ SEEDING ERROR:', err);
  } finally {
    await client.end();
  }
}

main();
