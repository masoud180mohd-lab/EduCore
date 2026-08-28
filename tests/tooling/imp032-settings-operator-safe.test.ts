import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-032 operator-safe tenant settings', () => {
  it('DSF-002 v1.23 documents operator-safe settings', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.23/);
    expect(dsf).toContain('IMP-032');
    expect(dsf).toContain('preserve-merge');
    expect(dsf).toMatch(/Advanced/i);
  });

  it('ships tenant-settings-form helper', () => {
    expect(existsSync(path.join(root, 'apps/web/src/lib/admin/tenant-settings-form.ts'))).toBe(
      true,
    );
    const helper = readFileSync(
      path.join(root, 'apps/web/src/lib/admin/tenant-settings-form.ts'),
      'utf8',
    );
    expect(helper).toContain('mergeSettingsForSave');
    expect(helper).toContain('splitKnownSettings');
  });

  it('settings page hides JSON by default and uses Advanced toggle', () => {
    const page = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/settings/page.tsx'),
      'utf8',
    );
    expect(page).toContain('tenant-settings-form');
    expect(page).toContain("t('settings.advanced')");
    expect(page).toContain('ConfirmDialog');
    expect(page).toContain('mergeSettingsForSave(loadedExtras');
    expect(page).not.toMatch(/Save replaces the settings object/i);
    const withoutAdvanced = page.replace(/showAdvanced \?[\s\S]*?: null/g, '');
    expect(withoutAdvanced).not.toContain('id="extrasJson"');
  });

  it('has task record', () => {
    expect(
      existsSync(
        path.join(root, 'docs/engineering/task-records/IMP-032-settings-operator-safe.md'),
      ),
    ).toBe(true);
  });
});
