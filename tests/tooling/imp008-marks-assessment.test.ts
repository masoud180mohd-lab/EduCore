import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-008 marks assessment', () => {
  it('has provisional freezes DSF-003 DBF-011 ACF-011', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/design-freeze/DSF-003-teacher-marks.md')),
    ).toBe(true);
    expect(
      existsSync(
        path.join(root, 'docs/engineering/database-freeze/DBF-011-marks-assessment-slice.md'),
      ),
    ).toBe(true);
    expect(
      existsSync(
        path.join(root, 'docs/engineering/api-contract-freeze/ACF-011-marks-assessment-slice.md'),
      ),
    ).toBe(true);
  });

  it('registers marks permissions and controller routes', () => {
    const codes = readFileSync(
      path.join(root, 'apps/api/src/common/policy/permission-codes.ts'),
      'utf8',
    );
    expect(codes).toContain("'marks.read'");
    expect(codes).toContain("'marks.manage'");
    expect(codes).toContain("'marks.approve'");
    const ctrl = readFileSync(
      path.join(root, 'apps/api/src/modules/assessment/controllers/marks.controller.ts'),
      'utf8',
    );
    expect(ctrl).toContain("RequirePermission('marks.manage')");
    expect(ctrl).toContain('exam-subjects');
    expect(ctrl).toContain("Get('api/v1/exam-subjects/:examSubjectId')");
  });

  it('ships teacher marks UI routes', () => {
    expect(
      existsSync(path.join(root, 'apps/web/src/app/t/[tenantId]/teacher/marks/page.tsx')),
    ).toBe(true);
    expect(
      existsSync(
        path.join(
          root,
          'apps/web/src/app/t/[tenantId]/teacher/marks/subjects/[examSubjectId]/page.tsx',
        ),
      ),
    ).toBe(true);
  });
});
