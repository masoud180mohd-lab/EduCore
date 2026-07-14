import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const migrationsDir = path.join(projectRoot, 'apps/api/db/migrations');
const bootstrapPath = path.join(projectRoot, 'apps/api/db/bootstrap/001_roles.sql');

function readMigration(name: string): string {
  return readFileSync(path.join(migrationsDir, name), 'utf8');
}

describe('AUDIT-R2 RLS INSERT hardening (G3)', () => {
  const hardening = readMigration('20260714170000_rls_insert_hardening.up.sql');
  const bootstrap = readFileSync(bootstrapPath, 'utf8');

  it('revokes INSERT on tenants/users from educore_app', () => {
    expect(hardening).toMatch(/REVOKE INSERT ON TABLE tenants FROM educore_app/i);
    expect(hardening).toMatch(/REVOKE INSERT ON TABLE users FROM educore_app/i);
  });

  it('introduces educore_platform and grants INSERT only to that role', () => {
    expect(hardening).toMatch(/CREATE ROLE educore_platform/i);
    expect(hardening).toMatch(/GRANT SELECT, INSERT, UPDATE ON TABLE tenants TO educore_platform/i);
    expect(hardening).toMatch(/GRANT SELECT, INSERT, UPDATE ON TABLE users TO educore_platform/i);
    expect(bootstrap).toMatch(/educore_platform/i);
  });

  it('binds privileged write to role + both GUCs (not OR spoof path)', () => {
    expect(hardening).toMatch(/app\.require_platform_write/i);
    expect(hardening).toMatch(/app\.is_trusted_platform_session/i);
    expect(hardening).toMatch(/current_user = 'educore_platform'/i);
    expect(hardening).toMatch(
      /is_platform_operator\(\)\s*\n\s*AND app\.rls_mode\(\) IN \('bootstrap', 'platform'\)/i,
    );
    // Must not recreate the spoofable OR insert policy for educore_app.
    expect(hardening.toUpperCase()).not.toMatch(
      /CREATE POLICY RLS_TENANTS_INSERT\s+ON\s+TENANTS\s+FOR\s+INSERT\s+TO\s+EDUCORE_APP/,
    );
  });

  it('has a paired down migration', () => {
    const down = readMigration('20260714170000_rls_insert_hardening.down.sql');
    expect(down.length).toBeGreaterThan(100);
    expect(down).toMatch(/DROP FUNCTION IF EXISTS app\.is_trusted_platform_session/i);
  });
});
