import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-017 AdminShell school name', () => {
  it('DSF-002 v1.6 documents AdminShell school name brand', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.(?:[6-9]|10|11|12)/);
    expect(dsf).toContain('IMP-017');
    expect(dsf).toMatch(/header brand = school name|school name from/i);
  });

  it('AdminShell loads tenants/current for brand', () => {
    const shell = readFileSync(path.join(root, 'apps/web/src/components/AdminShell.tsx'), 'utf8');
    expect(shell).toContain('/api/v1/tenants/current');
    expect(shell).toContain('EduCore Admin');
    expect(shell).toMatch(/result\.data\.name/);
  });

  it('has task record', () => {
    expect(
      existsSync(
        path.join(root, 'docs/engineering/task-records/IMP-017-admin-shell-school-name.md'),
      ),
    ).toBe(true);
  });
});
