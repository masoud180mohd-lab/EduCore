import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

const PICKER_PAGES = [
  'apps/web/src/app/t/[tenantId]/admin/fees/invoices/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/enrollments/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/streams/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/guardians/[guardianId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/users/[userId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/classes/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/terms/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/fees/structures/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/enrollments/[enrollmentId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/streams/[streamId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/terms/[termId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/classes/[classId]/page.tsx',
] as const;

describe('IMP-030 Wave X form pickers', () => {
  it('admin create/detail pickers use ResourceListPagination (Load more)', () => {
    for (const rel of PICKER_PAGES) {
      const src = readFileSync(path.join(root, rel), 'utf8');
      expect(src, rel).toContain('ResourceListPagination');
      expect(src, rel).not.toMatch(/PICKER_LIMIT\s*=\s*100/);
      expect(src, rel).not.toMatch(/\?limit=100/);
    }
  });

  it('DSF-002 documents Wave X picker Load more', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toContain('IMP-030x');
    expect(dsf).toContain('Form **pickers**');
    expect(dsf).toContain('Load more');
  });
});
