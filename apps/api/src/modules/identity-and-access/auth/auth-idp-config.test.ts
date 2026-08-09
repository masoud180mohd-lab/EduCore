import { describe, expect, it } from 'vitest';

import {
  auth0Issuer,
  loadAuth0Config,
  reportAuthIdpConfig,
  resolveAuthIdpProvider,
} from './auth-idp-config.js';

describe('auth-idp-config', () => {
  it('defaults provider to local', () => {
    expect(resolveAuthIdpProvider({})).toBe('local');
    expect(resolveAuthIdpProvider({ AUTH_IDP_PROVIDER: 'AUTH0' })).toBe('auth0');
  });

  it('loads Auth0 config only when domain and client id present', () => {
    expect(loadAuth0Config({})).toBeNull();
    expect(
      loadAuth0Config({
        AUTH0_DOMAIN: 'https://Educore-Dev.eu.auth0.com/',
        AUTH0_CLIENT_ID: 'client-1',
        AUTH0_CLIENT_SECRET: 'sec',
      }),
    ).toEqual({
      domain: 'educore-dev.eu.auth0.com',
      clientId: 'client-1',
      audience: null,
      clientSecret: 'sec',
    });
    expect(auth0Issuer('educore-dev.eu.auth0.com')).toBe('https://educore-dev.eu.auth0.com/');
  });

  it('reports assertionEnabled only for auth0 with secrets', () => {
    const report = reportAuthIdpConfig({
      AUTH_IDP_PROVIDER: 'auth0',
      AUTH0_DOMAIN: 'tenant.eu.auth0.com',
      AUTH0_CLIENT_ID: 'abc',
    });
    expect(report.assertionEnabled).toBe(true);
    expect(report.missingSecrets).toEqual([]);
    expect(report.issuerHost).toBe('tenant.eu.auth0.com');

    const blocked = reportAuthIdpConfig({ AUTH_IDP_PROVIDER: 'auth0' });
    expect(blocked.assertionEnabled).toBe(false);
    expect(blocked.missingSecrets).toContain('AUTH0_DOMAIN');
  });
});
