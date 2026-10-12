/**
 * Ops hygiene — print MFA enrollment counts only (no secrets, no factor secrets).
 * Usage: doppler run --project educore --config stg -- node scripts/ops-stg-mfa-status.mjs
 */
import { spawnSync } from 'node:child_process';
import pg from 'pg';

function getSecret(name) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'get', name, '--plain', '--project', 'educore', '--config', 'stg'],
    { encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) return undefined;
  const v = (r.stdout || '').trim();
  return v === '' ? undefined : v;
}

async function main() {
  const enforce = getSecret('MFA_ENFORCE') ?? '(unset)';
  const keyPresent = Boolean(getSecret('MFA_TOTP_ENCRYPTION_KEY'));
  process.stdout.write(`MFA_ENFORCE=${enforce}\n`);
  process.stdout.write(`MFA_TOTP_ENCRYPTION_KEY=${keyPresent ? 'present' : 'missing'}\n`);

  const url = getSecret('DATABASE_URL');
  if (!url) {
    process.stderr.write('DATABASE_URL missing — skip factor counts\n');
    process.exit(0);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const tables = await client.query(
    `select table_schema, table_name
     from information_schema.tables
     where table_name ilike '%mfa%' or table_name ilike '%totp%'
     order by 1, 2`,
  );
  process.stdout.write(
    `mfa_related_tables=${tables.rows.map((r) => `${r.table_schema}.${r.table_name}`).join(',') || '(none)'}\n`,
  );

  // Prefer known MFA-001 table names if present
  for (const candidate of ['user_mfa_factors', 'mfa_factors', 'user_totp_factors']) {
    const exists = tables.rows.some((r) => r.table_name === candidate);
    if (!exists) continue;
    const schema = tables.rows.find((r) => r.table_name === candidate)?.table_schema ?? 'public';
    const q = await client.query(`select count(*)::int as n from ${schema}.${candidate}`);
    process.stdout.write(`${schema}.${candidate}.count=${q.rows[0].n}\n`);
  }

  await client.end();
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
