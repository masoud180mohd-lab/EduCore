import { describe, expect, it } from 'vitest';

import { loadAppConfig } from './app-config.js';

describe('loadAppConfig', () => {
  it('loads non-secret defaults safely', () => {
    expect(
      loadAppConfig({
        NODE_ENV: 'test',
      }),
    ).toEqual({
      environment: 'test',
      port: 3000,
      serviceName: 'educore-api',
    });
  });

  it('rejects invalid ports without echoing secrets', () => {
    expect(() =>
      loadAppConfig({
        NODE_ENV: 'development',
        PORT: 'not-a-port',
      }),
    ).toThrow('PORT must be an integer between 1 and 65535.');
  });
});
