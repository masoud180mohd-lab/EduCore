/**
 * MFA-HARD-OPS — Flip staging MFA_ENFORCE=soft → hard after privileged enrollment.
 *
 * Preconditions (Owner machine with Doppler + flyctl):
 *   1. MFA_TOTP_ENCRYPTION_KEY already set
 *   2. Every privileged staging admin enrolled via Admin → Settings → Security
 *   3. Login challenge smoke passed under soft
 *
 * Usage:
 *   node scripts/ops-stg-mfa-hard.mjs           # require CONFIRM=YES
 *   CONFIRM=YES node scripts/ops-stg-mfa-hard.mjs
 *   CONFIRM=YES DRY_RUN=1 node scripts/ops-stg-mfa-hard.mjs
 *
 * Then: node scripts/ops-stg-sync-fly-secrets.mjs
 * Does not print secret values. Does not touch payments.
 */
import { spawnSync } from 'node:child_process';

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

function setSecret(name, value) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'set', name, '--project', 'educore', '--config', 'stg'],
    {
      input: value,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    },
  );
  if (r.status !== 0) {
    process.stderr.write(`Failed to set ${name}: ${(r.stderr || r.stdout || 'unknown').trim()}\n`);
    process.exit(1);
  }
  process.stdout.write(`set ${name}=${value}\n`);
}

const confirm = (process.env['CONFIRM'] ?? '').trim().toUpperCase();
const dryRun = (process.env['DRY_RUN'] ?? '').trim() === '1';

if (confirm !== 'YES') {
  process.stderr.write(
    'Refusing MFA-HARD flip without CONFIRM=YES.\n' +
      'Enroll privileged users under soft first (Admin → Settings → Security).\n' +
      'Example: CONFIRM=YES node scripts/ops-stg-mfa-hard.mjs\n',
  );
  process.exit(2);
}

const key = getSecret('MFA_TOTP_ENCRYPTION_KEY');
if (key === undefined) {
  process.stderr.write('MFA_TOTP_ENCRYPTION_KEY missing in educore/stg — abort.\n');
  process.exit(1);
}
process.stdout.write('MFA_TOTP_ENCRYPTION_KEY present\n');

const current = getSecret('MFA_ENFORCE') ?? '(unset)';
process.stdout.write(`current MFA_ENFORCE=${current}\n`);

if (current === 'hard') {
  process.stdout.write(
    'Already hard — no change. Sync Fly if needed: node scripts/ops-stg-sync-fly-secrets.mjs\n',
  );
  process.exit(0);
}

if (dryRun) {
  process.stdout.write('DRY_RUN=1 — would set MFA_ENFORCE=hard then sync Fly.\n');
  process.exit(0);
}

setSecret('MFA_ENFORCE', 'hard');
process.stdout.write(
  'Next: node scripts/ops-stg-sync-fly-secrets.mjs\n' +
    'Smoke: privileged login without TOTP → 403; with TOTP → challenge then session.\n' +
    'Rollback: doppler secrets set MFA_ENFORCE soft --project educore --config stg\n',
);
