import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-015 admin students UI', () => {
  it('DSF-002 v1.4 documents students create + edit', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.4/);
    expect(dsf).toContain('IMP-015');
    expect(dsf).toMatch(/Students list \+ create \+ edit|create\/edit forms/i);
  });

  it('ships list create and detail PATCH routes', () => {
    const base = path.join(root, 'apps/web/src/app/t/[tenantId]/admin/students');
    expect(existsSync(path.join(base, 'page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, '[studentId]', 'page.tsx'))).toBe(true);
    const list = readFileSync(path.join(base, 'page.tsx'), 'utf8');
    expect(list).toContain("method: 'POST'");
    expect(list).toContain('/api/v1/students');
    expect(list).not.toMatch(/create deferred/i);
    const detail = readFileSync(path.join(base, '[studentId]', 'page.tsx'), 'utf8');
    expect(detail).toContain("method: 'PATCH'");
    expect(detail).not.toContain("method: 'DELETE'");
  });

  it('has task record and manual QA checklist', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-015-admin-students-ui.md')),
    ).toBe(true);
    expect(existsSync(path.join(root, 'tasks/manual-test-admin-students-qa.md'))).toBe(true);
  });
});
