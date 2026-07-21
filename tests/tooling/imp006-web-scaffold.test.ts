import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-006 web scaffold', () => {
  it('has provisional DSF-001', () => {
    const dsf = path.join(root, 'docs/engineering/design-freeze/DSF-001-teacher-attendance.md');
    expect(existsSync(dsf)).toBe(true);
    const text = readFileSync(dsf, 'utf8');
    expect(text).toMatch(/solo-operator provisional/i);
    expect(text).toContain('--color-accent');
  });

  it('registers @educore/web workspace package', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'apps/web/package.json'), 'utf8')) as {
      name: string;
    };
    expect(pkg.name).toBe('@educore/web');
    expect(existsSync(path.join(root, 'apps/web/src/app/login/page.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'apps/web/.env.example'))).toBe(true);
    const envExample = readFileSync(path.join(root, 'apps/web/.env.example'), 'utf8');
    expect(envExample).not.toMatch(/password|secret|token=/i);
  });

  it('wires web typecheck into root typecheck script', () => {
    const rootPkg = readFileSync(path.join(root, 'package.json'), 'utf8');
    expect(rootPkg).toContain('typecheck -w @educore/web');
  });
});
