import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

function walkTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walkTsx(full) : full.endsWith('.tsx') ? [full] : [];
  });
}

describe('IMP-035 admin error mapper', () => {
  it('DSF-002 v1.21 documents central adminFriendlyMessage', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.21/);
    expect(dsf).toContain('IMP-035');
    expect(dsf).toContain('adminFriendlyMessage');
    expect(dsf).toContain('finance reconcile access');
  });

  it('ships central mapper module', () => {
    expect(existsSync(path.join(root, 'apps/web/src/lib/admin/admin-friendly-message.ts'))).toBe(
      true,
    );
    expect(existsSync(path.join(root, 'apps/web/src/lib/api/api-friendly-message.ts'))).toBe(true);
  });

  it('admin pages use adminFriendlyMessage not teacherFriendlyMessage', () => {
    const adminRoot = path.join(root, 'apps/web/src/app/t/[tenantId]/admin');
    const pages = walkTsx(adminRoot);
    for (const file of pages) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('ApiClientError')) continue;
      expect(src, file).not.toContain('teacherFriendlyMessage');
      expect(src, file).not.toMatch(/function \w+Message\(/);
      if (src.includes('setError(') || src.includes('setUsersError(')) {
        expect(src, file).toContain('adminFriendlyMessage');
      }
    }
  });

  it('has task record', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-035-admin-error-mapper.md')),
    ).toBe(true);
  });
});
