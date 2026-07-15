import { describe, expect, it } from 'vitest';

import {
  assertSeedAllowed,
  loadSeedAdminConfig,
  SEED_MEMBERSHIP_ID,
  SEED_TENANT_ID,
  SEED_USER_ID,
} from '../../scripts/seed-local-admin.js';

describe('seed-local-admin config', () => {
  it('requires a credential of at least 8 characters', () => {
    expect(() =>
      loadSeedAdminConfig({
        SEED_ADMIN_PASS: 'short',
      }),
    ).toThrow(/SEED_ADMIN_PASS/);
  });

  it('loads local defaults when SEED_ADMIN_PASS is set', () => {
    const config = loadSeedAdminConfig({
      SEED_ADMIN_PASS: 'password12',
      NODE_ENV: 'development',
    });
    expect(config.email).toBe('admin@educore.local');
    expect(config.tenantCode).toBe('demo-school');
    expect(config.connectionString).toContain('educore_platform');
    expect(config.resetPassword).toBe(false);
  });

  it('accepts legacy SEED_ADMIN_PASSWORD alias', () => {
    const config = loadSeedAdminConfig({
      SEED_ADMIN_PASSWORD: 'password12',
    });
    expect(config.password).toBe('password12');
  });

  it('blocks production without allow flag', () => {
    expect(() =>
      assertSeedAllowed({
        email: 'a@b.co',
        password: 'password12',
        tenantCode: 'demo-school',
        tenantName: 'Demo',
        connectionString: 'postgresql://x',
        resetPassword: false,
        allowProduction: false,
        nodeEnv: 'production',
      }),
    ).toThrow(/production/);
  });

  it('exposes stable seed UUIDs for docs and re-runs', () => {
    expect(SEED_TENANT_ID).toMatch(/^01900000-/);
    expect(SEED_USER_ID).toMatch(/^01900000-/);
    expect(SEED_MEMBERSHIP_ID).toMatch(/^01900000-/);
  });
});
