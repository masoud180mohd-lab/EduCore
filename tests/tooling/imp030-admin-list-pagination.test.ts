import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

const REGISTRY_PAGES = [
  'apps/web/src/app/t/[tenantId]/admin/students/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/users/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/guardians/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/organizations/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/memberships/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/roles/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/years/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/terms/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/classes/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/streams/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/subjects/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/enrollments/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/fees/structures/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/fees/invoices/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/fees/receipts/page.tsx',
] as const;

describe('IMP-030 admin list pagination', () => {
  it('ships list-pagination helper and ResourceListPagination', () => {
    for (const file of [
      'apps/web/src/lib/admin/list-pagination.ts',
      'apps/web/src/components/admin/ResourceListPagination.tsx',
      'apps/web/src/components/admin/ResourceList.tsx',
      'apps/web/src/components/admin/index.ts',
    ]) {
      const src = readFileSync(path.join(root, file), 'utf8');
      expect(src.length).toBeGreaterThan(40);
    }
    const index = readFileSync(path.join(root, 'apps/web/src/components/admin/index.ts'), 'utf8');
    expect(index).toContain('ResourceListPagination');
    const helper = readFileSync(
      path.join(root, 'apps/web/src/lib/admin/list-pagination.ts'),
      'utf8',
    );
    expect(helper).toContain('buildListQuery');
    expect(helper).toContain('appendById');
    expect(helper).toContain('readPageMeta');
  });

  it('DSF-002 documents Load more cursor pagination', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toContain('Load more');
    expect(dsf).toContain('nextCursor');
    expect(dsf).toContain('IMP-030');
  });

  it('migrates primary admin registries to ResourceListPagination', () => {
    for (const file of REGISTRY_PAGES) {
      const src = readFileSync(path.join(root, file), 'utf8');
      expect(src, file).toContain('ResourceListPagination');
      expect(src, file).toContain('buildListQuery');
      expect(src, file).toContain('readPageMeta');
      expect(src, file).toContain('appendById');
    }
  });
});
