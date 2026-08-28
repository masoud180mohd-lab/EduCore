/** One-off: probe parent login failure detail (prints error code only). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = 'https://educore-api-staging.fly.dev';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cred = readFileSync(path.join(root, '.local', 'stg-uat-parent.txt'), 'utf8');
const email = /^email=(.+)$/m.exec(cred)[1];
const password = /^password=(.+)$/m.exec(cred)[1];

// tenant id from parent membership (via Doppler DATABASE_URL)
const pg = (await import('pg')).default;
const client = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
await client.connect();
const m = await client.query(
  `SELECT tm.tenant_id FROM users u JOIN tenant_memberships tm ON tm.user_id = u.id
   WHERE lower(u.email) = lower($1) AND tm.status = 'active'`,
  [email],
);
await client.end();
const tenantId = m.rows[0]?.tenant_id;
if (tenantId === undefined) {
  process.stdout.write('no active membership\n');
  process.exit(1);
}

const res = await fetch(`${base}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ email, password, tenantId }),
});
const body = await res.json().catch(() => null);
process.stdout.write(
  `login http ${res.status} code=${body?.error?.code} message=${body?.error?.message}\n`,
);
