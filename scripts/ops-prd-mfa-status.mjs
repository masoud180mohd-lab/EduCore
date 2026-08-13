/**
 * Production MFA hygiene — counts only. No secrets, emails, or factor payloads.
 *
 * Usage: node scripts/ops-prd-mfa-status.mjs
 */
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const CONFIG = 'prd';

function getSecret(name) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'get', name, '--plain', '--project', 'educore', '--config', CONFIG],
    { encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) return undefined;
  const v = (r.stdout || '').trim();
  return v === '' ? undefined : v;
}

async function main() {
  const enforce = getSecret('MFA_ENFORCE') ?? '(unset)';
  const keyPresent = Boolean(getSecret('MFA_TOTP_ENCRYPTION_KEY'));
  process.stdout.write(`config=${CONFIG}\n`);
  process.stdout.write(`MFA_ENFORCE=${enforce}\n`);
  process.stdout.write(`MFA_TOTP_ENCRYPTION_KEY=${keyPresent ? 'present' : 'missing'}\n`);

  const url = getSecret('DATABASE_URL');
  if (!url) {
    process.stderr.write('DATABASE_URL missing — skip factor counts\n');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const factors = await client.query(
    `SELECT
       count(*) FILTER (WHERE factor_type = 'totp' AND status = 'active')::int AS active_totp,
       count(*) FILTER (WHERE factor_type = 'totp' AND status = 'pending')::int AS pending_totp
     FROM mfa_factors`,
  );
  const privileged = await client.query(
    `SELECT
       count(DISTINCT ur.user_id)::int AS privileged_users,
       count(DISTINCT ur.user_id) FILTER (
         WHERE NOT EXISTS (
           SELECT 1 FROM mfa_factors f
           WHERE f.user_id = ur.user_id
             AND f.factor_type = 'totp'
             AND f.status = 'active'
         )
       )::int AS privileged_without_totp
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     JOIN role_permissions rp ON rp.role_id = r.id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE p.code IN ('finance.manage', 'tenant.manage', 'role.manage')`,
  );
  await client.end();

  const f = factors.rows[0];
  const p = privileged.rows[0];
  process.stdout.write(`active_totp=${f.active_totp}\n`);
  process.stdout.write(`pending_totp=${f.pending_totp}\n`);
  process.stdout.write(`privileged_users=${p.privileged_users}\n`);
  process.stdout.write(`privileged_without_totp=${p.privileged_without_totp}\n`);
  if (p.privileged_without_totp > 0 || f.active_totp === 0) {
    process.stdout.write('hard_flip=blocked (enroll TOTP for privileged users first)\n');
  } else {
    process.stdout.write('hard_flip=allowed\n');
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
