import { describe, expect, it } from 'vitest';

import { loadDatabaseConfig, loadWebhookDatabaseConfig } from './database-config.js';

describe('loadDatabaseConfig', () => {
  it('disables the pool by default (CI / local without flag)', () => {
    expect(loadDatabaseConfig({})).toEqual({
      enabled: false,
      maxConnections: 10,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 2_000,
    });
  });

  it('does not use generic DATABASE_URL (migrator risk)', () => {
    const config = loadDatabaseConfig({
      DATABASE_URL: 'postgresql://postgres:secret@127.0.0.1:5432/educore',
    });
    expect(config.enabled).toBe(false);
  });

  it('enables with EDUCORE_APP_DATABASE_URL', () => {
    const config = loadDatabaseConfig({
      EDUCORE_APP_DATABASE_URL: 'postgresql://educore_app:x@127.0.0.1:5432/educore',
    });
    expect(config.enabled).toBe(true);
    expect(config.connectionString).toContain('educore_app');
  });

  it('enables default local app URL when EDUCORE_ENABLE_APP_DB=1', () => {
    const config = loadDatabaseConfig({ EDUCORE_ENABLE_APP_DB: '1' });
    expect(config.enabled).toBe(true);
    expect(config.connectionString).toContain('educore_app');
  });
});

describe('loadWebhookDatabaseConfig', () => {
  it('disables the webhook pool by default', () => {
    expect(loadWebhookDatabaseConfig({}).enabled).toBe(false);
  });

  it('does not use EDUCORE_APP_DATABASE_URL', () => {
    const config = loadWebhookDatabaseConfig({
      EDUCORE_APP_DATABASE_URL: 'postgresql://educore_app:x@127.0.0.1:5432/educore',
    });
    expect(config.enabled).toBe(false);
  });

  it('enables with EDUCORE_WEBHOOK_DATABASE_URL', () => {
    const config = loadWebhookDatabaseConfig({
      EDUCORE_WEBHOOK_DATABASE_URL: 'postgresql://educore_webhook:x@127.0.0.1:5432/educore',
    });
    expect(config.enabled).toBe(true);
    expect(config.connectionString).toContain('educore_webhook');
  });

  it('uses default webhook URL when EDUCORE_ENABLE_APP_DB=1', () => {
    const config = loadWebhookDatabaseConfig({ EDUCORE_ENABLE_APP_DB: '1' });
    expect(config.enabled).toBe(true);
    expect(config.connectionString).toContain('educore_webhook');
  });
});
