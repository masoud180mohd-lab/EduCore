import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('FLY-WEB image artifacts', () => {
  it('has a web Dockerfile and Fly configs pointing at Fly APIs', () => {
    const dockerfile = path.join(root, 'apps/web/Dockerfile');
    const stg = path.join(root, 'infra/fly/educore-web.staging.toml');
    const prd = path.join(root, 'infra/fly/educore-web.toml');
    expect(existsSync(dockerfile)).toBe(true);
    expect(existsSync(stg)).toBe(true);
    expect(existsSync(prd)).toBe(true);
    expect(readFileSync(stg, 'utf8')).toContain('educore-api-staging.fly.dev');
    expect(readFileSync(prd, 'utf8')).toContain('educore-api.fly.dev');
    expect(readFileSync(dockerfile, 'utf8')).toContain('apps/web/server.js');
  });
});
