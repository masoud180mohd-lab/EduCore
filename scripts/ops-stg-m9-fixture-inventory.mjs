/**
 * M9-002 fixture inventory — staging (read-only).
 *
 * Counts the entities the UAT checklist needs (C5 parent link, D2 org/class,
 * D3 exam/subject) plus the fee-path rows created by the earlier UAT run.
 * Prints counts and ids only — no PII, no secrets.
 *
 * Usage:
 *   doppler run --project educore --config stg -- node scripts/ops-stg-m9-fixture-inventory.mjs
 */
import pg from 'pg';

async function main() {
  const url = process.env['DATABASE_URL']?.trim();
  if (!url) throw new Error('DATABASE_URL required');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const q = async (sql, params = []) => (await client.query(sql, params)).rows;
  try {
    const counts = {};
    for (const table of [
      'tenants',
      'users',
      'tenant_memberships',
      'organizations',
      'academic_years',
      'classes',
      'streams',
      'subjects',
      'students',
      'enrollments',
      'guardians',
      'student_guardians',
      'fee_structures',
      'invoices',
      'payments',
      'receipts',
      'exams',
      'attendance_sessions',
      'role_assignments',
    ]) {
      try {
        const rows = await q(`SELECT count(*)::int AS n FROM ${table}`);
        counts[table] = rows[0].n;
      } catch (err) {
        counts[table] = `error: ${String(err.message ?? err).split('\n')[0]}`;
      }
    }
    process.stdout.write('== counts ==\n');
    for (const [k, v] of Object.entries(counts)) process.stdout.write(`${k}: ${v}\n`);

    process.stdout.write('\n== guardian links ==\n');
    const links = await q(
      `SELECT sg.id::text AS id, sg.student_id, sg.guardian_id FROM student_guardians sg LIMIT 5`,
    ).catch(() => []);
    for (const l of links) {
      process.stdout.write(`link ${l.id}: student=${l.student_id} guardian=${l.guardian_id}\n`);
    }

    process.stdout.write('\n== guardian users with active memberships ==\n');
    const gusers = await q(
      `SELECT u.id FROM users u
       WHERE lower(u.email) LIKE 'parent%'
       LIMIT 5`,
    ).catch(() => []);
    for (const g of gusers) process.stdout.write(`parent-user id=${g.id}\n`);

    process.stdout.write('\n== invoices (id only) ==\n');
    const invs = await q(`SELECT id, student_id, status FROM invoices LIMIT 5`).catch(() => []);
    for (const i of invs) {
      process.stdout.write(`invoice ${i.id}: student=${i.student_id} status=${i.status}\n`);
    }

    process.stdout.write('\n== exams ==\n');
    const exams = await q(`SELECT id, status FROM exams LIMIT 5`).catch(() => []);
    for (const e of exams) process.stdout.write(`exam ${e.id}: status=${e.status}\n`);

    process.stdout.write('\n== roles present ==\n');
    const roles = await q(
      `SELECT DISTINCT role_code FROM tenant_memberships ORDER BY role_code`,
    ).catch(() => []);
    for (const r of roles) process.stdout.write(`role: ${r.role_code}\n`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
