import { describe, expect, it } from 'vitest';

import { resolveCorsOrigins } from './cors-origins.js';

describe('resolveCorsOrigins', () => {
  it('always includes local web/api origins', () => {
    const origins = resolveCorsOrigins({});
    expect(origins).toContain('http://localhost:3001');
    expect(origins).toContain('http://127.0.0.1:3001');
  });

  it('adds CORS_ORIGINS https hosts and drops wildcards', () => {
    const origins = resolveCorsOrigins({
      CORS_ORIGINS: 'https://educore-web.fly.dev, https://evil.example/path, *',
    });
    expect(origins).toContain('https://educore-web.fly.dev');
    expect(origins.some((o) => o.includes('*'))).toBe(false);
    expect(origins.some((o) => o.includes('/path'))).toBe(false);
  });
});
