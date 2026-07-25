import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-019 admin settings + guardian profile edit', () => {
  it('DSF-002 v1.8 documents settings edit and guardian profile edit', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.[89]/);
    expect(dsf).toContain('IMP-019');
    expect(dsf).toMatch(/Tenant settings edit|settings form/i);
    expect(dsf).toMatch(/profile edit/i);
  });

  it('Settings page PUTs tenant-settings without edit deferred', () => {
    const page = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/settings/page.tsx'),
      'utf8',
    );
    expect(page).toContain('/api/v1/tenant-settings');
    expect(page).toContain("method: 'PUT'");
    expect(page).not.toMatch(/edit deferred/i);
    expect(page).toContain('timezone');
  });

  it('Guardian detail PATCHes profile fields', () => {
    const page = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/guardians/[guardianId]/page.tsx'),
      'utf8',
    );
    expect(page).toContain("method: 'PATCH'");
    expect(page).toContain('/api/v1/guardians/');
    expect(page).toContain('Save profile');
    expect(page).toContain('displayName');
  });

  it('has task record and manual QA', () => {
    expect(
      existsSync(
        path.join(root, 'docs/engineering/task-records/IMP-019-admin-settings-guardian-edit.md'),
      ),
    ).toBe(true);
    expect(existsSync(path.join(root, 'tasks/manual-test-admin-settings-guardian-qa.md'))).toBe(
      true,
    );
  });
});
