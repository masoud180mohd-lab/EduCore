import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-046 AdminShell office console', () => {
  it('DSF-KIT-001 v1.1 documents left rail AdminShell', () => {
    const kit = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-KIT-001-design-system-freeze.md'),
      'utf8',
    );
    expect(kit).toMatch(/1\.1/);
    expect(kit).toContain('--color-rail');
    expect(kit).toContain('Left rail');
    expect(kit).toContain('72rem');
  });

  it('DSF-002 v1.28 keeps Option A groups on a rail', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.28/);
    expect(dsf).toContain('IMP-046');
    expect(dsf).toMatch(/Option A/i);
    expect(dsf).toContain('left rail');
  });

  it('AdminShell renders console chrome and keeps IMP-029/033 contracts', () => {
    const shell = readFileSync(path.join(root, 'apps/web/src/components/AdminShell.tsx'), 'utf8');
    expect(shell).toContain('admin-console');
    expect(shell).toContain('admin-console-rail');
    expect(shell).toContain('admin-console-top');
    expect(shell).toContain('groupAdminNav');
    expect(shell).toContain('visibleAdminNavIds');
    expect(shell).toContain('canAccessAdminShell');
    expect(shell).toContain('admin-nav-groups');
    expect(shell).toContain('aria-label="Admin"');
    expect(shell).not.toContain('top-nav-grouped');
  });

  it('tokens define rail layout and 44px targets', () => {
    const tokens = readFileSync(path.join(root, 'apps/web/src/styles/tokens.css'), 'utf8');
    expect(tokens).toContain('--color-rail');
    expect(tokens).toContain('.admin-console-rail');
    expect(tokens).toContain('min-height: 44px');
  });

  it('has task record', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-046-admin-console-layout.md')),
    ).toBe(true);
  });
});
