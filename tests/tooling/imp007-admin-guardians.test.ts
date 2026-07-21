import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-007 admin + guardians', () => {
  it('has provisional DSF-002', () => {
    const dsf = path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md');
    expect(existsSync(dsf)).toBe(true);
    const text = readFileSync(dsf, 'utf8');
    expect(text).toMatch(/solo-operator provisional/i);
    expect(text).toContain('AdminShell');
  });

  it('has DBF-010 and ACF-010 freezes', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/database-freeze/DBF-010-guardians-slice.md')),
    ).toBe(true);
    expect(
      existsSync(
        path.join(root, 'docs/engineering/api-contract-freeze/ACF-010-guardians-slice.md'),
      ),
    ).toBe(true);
  });

  it('ships admin and guardians web routes', () => {
    expect(existsSync(path.join(root, 'apps/web/src/app/t/[tenantId]/admin/page.tsx'))).toBe(true);
    expect(
      existsSync(path.join(root, 'apps/web/src/app/t/[tenantId]/admin/guardians/page.tsx')),
    ).toBe(true);
  });

  it('registers guardian permissions in catalogue', () => {
    const codes = readFileSync(
      path.join(root, 'apps/api/src/common/policy/permission-codes.ts'),
      'utf8',
    );
    expect(codes).toContain("'guardian.read'");
    expect(codes).toContain("'guardian.manage'");
  });
});
