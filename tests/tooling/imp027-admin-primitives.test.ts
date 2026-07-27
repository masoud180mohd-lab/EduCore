import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-027 admin primitives', () => {
  it('ships Banner ResourceList StatusChip ConfirmDialog AdminPageHeader', () => {
    for (const file of [
      'apps/web/src/components/admin/Banner.tsx',
      'apps/web/src/components/admin/ResourceList.tsx',
      'apps/web/src/components/admin/StatusChip.tsx',
      'apps/web/src/components/admin/ConfirmDialog.tsx',
      'apps/web/src/components/admin/AdminPageHeader.tsx',
      'apps/web/src/components/admin/index.ts',
    ]) {
      expect(readFileSync(path.join(root, file), 'utf8').length).toBeGreaterThan(40);
    }
  });

  it('migrates students guardians organizations lists to ResourceList', () => {
    for (const file of [
      'apps/web/src/app/t/[tenantId]/admin/students/page.tsx',
      'apps/web/src/app/t/[tenantId]/admin/guardians/page.tsx',
      'apps/web/src/app/t/[tenantId]/admin/organizations/page.tsx',
    ]) {
      const src = readFileSync(path.join(root, file), 'utf8');
      expect(src).toContain('ResourceList');
      expect(src).toContain('AdminPageHeader');
      expect(src).toContain('StatusChip');
    }
  });

  it('uses ConfirmDialog on organization deactivate', () => {
    const src = readFileSync(
      path.join(
        root,
        'apps/web/src/app/t/[tenantId]/admin/organizations/[organizationId]/page.tsx',
      ),
      'utf8',
    );
    expect(src).toContain('ConfirmDialog');
    expect(src).not.toContain('window.confirm');
  });
});
