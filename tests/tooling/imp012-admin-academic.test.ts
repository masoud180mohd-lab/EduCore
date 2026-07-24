import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-012 admin academic UI', () => {
  it('DSF-002 documents Academic hub and structure edit (IMP-012/013)', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.[123]/);
    expect(dsf).toContain('Academic');
    expect(dsf).toContain('/admin/academic');
    expect(dsf).toContain('IMP-012');
    expect(dsf).toContain('enrollments');
  });

  it('AdminShell and home include Academic nav', () => {
    const shell = readFileSync(path.join(root, 'apps/web/src/components/AdminShell.tsx'), 'utf8');
    expect(shell).toContain('${base}/academic');
    expect(shell).toContain("label: 'Academic'");
    const home = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/page.tsx'),
      'utf8',
    );
    expect(home).toContain('/academic');
  });

  it('ships hub and entity list/detail routes', () => {
    const base = path.join(root, 'apps/web/src/app/t/[tenantId]/admin/academic');
    expect(existsSync(path.join(base, 'page.tsx'))).toBe(true);
    for (const segment of ['years', 'terms', 'classes', 'streams', 'subjects', 'enrollments']) {
      expect(existsSync(path.join(base, segment, 'page.tsx'))).toBe(true);
    }
    expect(existsSync(path.join(base, 'years', '[yearId]', 'page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'enrollments', '[enrollmentId]', 'page.tsx'))).toBe(true);
    const enrollDetail = readFileSync(
      path.join(base, 'enrollments', '[enrollmentId]', 'page.tsx'),
      'utf8',
    );
    expect(enrollDetail).toContain("method: 'PATCH'");
    expect(enrollDetail).toContain('Update status');
  });

  it('has task record and manual QA checklist', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-012-admin-academic-ui.md')),
    ).toBe(true);
    expect(existsSync(path.join(root, 'tasks/manual-test-admin-academic-qa.md'))).toBe(true);
  });
});
