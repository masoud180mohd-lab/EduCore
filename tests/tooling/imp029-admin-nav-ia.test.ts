import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-029 AdminShell nav IA', () => {
  it('DSF-002 v1.19 documents Option A grouped nav and 768px rule', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.19/);
    expect(dsf).toContain('IMP-029');
    expect(dsf).toMatch(/Option A/i);
    expect(dsf).toContain('groupAdminNav');
    expect(dsf).toMatch(/768/);
    expect(dsf).toContain('Registry');
    expect(dsf).toContain('Empty groups');
  });

  it('AdminShell uses groupAdminNav and keeps IMP-033 filter', () => {
    const shell = readFileSync(path.join(root, 'apps/web/src/components/AdminShell.tsx'), 'utf8');
    expect(shell).toContain('groupAdminNav');
    expect(shell).toContain('visibleAdminNavIds');
    expect(shell).toContain('canAccessAdminShell');
    expect(shell).toContain('navGroups');
    expect(shell).toContain('groupMessageKey');
  });

  it('home hub mirrors groups', () => {
    const home = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/page.tsx'),
      'utf8',
    );
    expect(home).toContain('groupAdminNav');
    expect(home).toContain('group.items');
    expect(home).toContain('ADMIN_HUB_BY_ID');
  });

  it('tokens define grouped nav layout', () => {
    const tokens = readFileSync(path.join(root, 'apps/web/src/styles/tokens.css'), 'utf8');
    expect(tokens).toContain('.admin-nav-group');
    expect(tokens).toContain('min-height: 44px');
  });

  it('has task record and manual QA', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-029-admin-nav-ia.md')),
    ).toBe(true);
    expect(existsSync(path.join(root, 'tasks/manual-test-admin-nav-ia-qa.md'))).toBe(true);
  });
});
