import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-023 admin memberships list', () => {
  it('DSF-002 v1.12 documents memberships list', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.(?:12|13|14|15|16|17|18)/);
    expect(dsf).toContain('IMP-023');
    expect(dsf).toMatch(/Memberships list/i);
  });

  it('Admin memberships page lists with status filter', () => {
    const page = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/memberships/page.tsx'),
      'utf8',
    );
    expect(page).toContain('/api/v1/memberships');
    expect(page).toMatch(/status[=:]/);
    expect(page).toContain('/admin/users/');
  });

  it('AdminShell and home link to memberships', () => {
    const shell = readFileSync(path.join(root, 'apps/web/src/components/AdminShell.tsx'), 'utf8');
    expect(shell).toContain('/memberships');
    const home = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/page.tsx'),
      'utf8',
    );
    expect(home).toContain('/memberships');
  });

  it('has task record and manual QA', () => {
    expect(
      existsSync(
        path.join(root, 'docs/engineering/task-records/IMP-023-admin-memberships-list.md'),
      ),
    ).toBe(true);
    expect(existsSync(path.join(root, 'tasks/manual-test-admin-memberships-list-qa.md'))).toBe(
      true,
    );
  });
});
