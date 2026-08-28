/**
 * MFA-HARD-OPS — Flip production MFA_ENFORCE=soft → hard after privileged TOTP.
 * Refuses if any privileged user lacks active TOTP (would lock finance/admin).
 *
 * Usage:
 *   CONFIRM=YES node scripts/ops-prd-mfa-hard.mjs
 * Then: node scripts/ops-prod-sync-fly-secrets.mjs
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

function setSecret(name, value) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'set', name, '--silent', '--project', 'educore', '--config', CONFIG],
    { input: value, encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) {
    process.stderr.write(`Failed to set ${name}: ${(r.stderr || r.stdout || 'unknown').trim()}\n`);
    process.exit(1);
  }
  process.stdout.write(`set ${name}=${value}\n`);
}

async function privilegedWithoutTotp(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const q = await client.query(
    `SELECT count(DISTINCT ur.user_id)::int AS n
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     JOIN role_permissions rp ON rp.role_id = r.id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE p.code IN ('finance.manage', 'tenant.manage', 'role.manage')
       AND NOT EXISTS (
         SELECT 1 FROM mfa_factors f
         WHERE f.user_id = ur.user_id
           AND f.factor_type = 'totp'
           AND f.status = 'active'
       )`,
  );
  await client.end();
  return q.rows[0]?.n ?? -1;
}

async function main() {
  if ((process.env['CONFIRM'] ?? '').trim().toUpperCase() !== 'YES') {
    process.stderr.write('Refusing MFA-HARD flip without CONFIRM=YES.\n');
    process.exit(2);
  }

  if (!getSecret('MFA_TOTP_ENCRYPTION_KEY')) {
    process.stderr.write('MFA_TOTP_ENCRYPTION_KEY missing in educore/prd — abort.\n');
    process.exit(1);
  }
  process.stdout.write('MFA_TOTP_ENCRYPTION_KEY present\n');

  const current = getSecret('MFA_ENFORCE') ?? '(unset)';
  process.stdout.write(`current MFA_ENFORCE=${current}\n`);

  const url = getSecret('DATABASE_URL');
  if (!url) {
    process.stderr.write('DATABASE_URL missing\n');
    process.exit(1);
  }
  const missing = await privilegedWithoutTotp(url);
  process.stdout.write(`privileged_without_totp=${missing}\n`);
  if (missing !== 0) {
    process.stderr.write(
      'Abort: privileged users lack active TOTP. Enroll admin@educore.prod under soft first.\n',
    );
    process.exit(1);
  }

  if (current === 'hard') {
    process.stdout.write('Already hard — sync Fly: node scripts/ops-prod-sync-fly-secrets.mjs\n');
    process.exit(0);
  }

  setSecret('MFA_ENFORCE', 'hard');
  process.stdout.write(
    'Next: node scripts/ops-prod-sync-fly-secrets.mjs\n' +
      'Rollback: doppler secrets set MFA_ENFORCE=soft --silent --project educore --config prd\n',
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
