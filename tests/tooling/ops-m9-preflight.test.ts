import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('M9 staging UAT preflight', () => {
  const script = readFileSync(path.join(root, 'scripts/ops-stg-m9-uat.mjs'), 'utf8');
  it('is restricted to the two HTTPS staging Fly hosts', () => {
    expect(script).toContain("const DEFAULT_API_BASE = 'https://educore-api-staging.fly.dev'");
    expect(script).toContain("const DEFAULT_WEB_BASE = 'https://educore-web-staging.fly.dev'");
    expect(script).toContain("url.protocol !== 'https:'");
    expect(script).toContain("url.hostname !== 'educore-api-staging.fly.dev'");
    expect(script).toContain("url.hostname !== 'educore-web-staging.fly.dev'");
  });

  it('records only preflight-safe evidence and preserves Owner-run UAT', () => {
    expect(script).toContain("api.pathname = '/health'");
    expect(script).toContain('not workflow UAT');
    expect(script).toContain(
      'no response body, credential, token, email, tenant ID, or learner data',
    );
    expect(script).toContain('Owner must still complete');
    expect(script).not.toContain('/api/v1/auth/login');
    expect(script).not.toContain('SEED_ADMIN_PASS');
  });
});
