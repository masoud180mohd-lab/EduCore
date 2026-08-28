import { spawnSync } from 'node:child_process';
import pg from 'pg';

function getSecret(name) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'get', name, '--plain', '--project', 'educore', '--config', 'prd'],
    { encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) return undefined;
  const v = (r.stdout || '').trim();
  return v === '' ? undefined : v;
}

const url = getSecret('DATABASE_URL');
if (!url) {
  process.stderr.write('DATABASE_URL missing\n');
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
const q = await client.query(
  `UPDATE mfa_factors
   SET status = 'disabled', updated_at = now()
   WHERE factor_type = 'totp' AND status IN ('active', 'pending')
   RETURNING id`,
);
await client.end();
process.stdout.write(`disabled_factors=${q.rowCount}\n`);
process.stdout.write(`MFA_ENFORCE=${getSecret('MFA_ENFORCE') ?? '(unset)'}\n`);
