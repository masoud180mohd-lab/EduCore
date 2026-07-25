import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-018 enrollment transfer', () => {
  it('ACF-008 rev 1.4 documents classId/streamId PATCH', () => {
    const acf = readFileSync(
      path.join(root, 'docs/engineering/api-contract-freeze/ACF-008-enrollments-slice.md'),
      'utf8',
    );
    expect(acf).toMatch(/1\.4/);
    expect(acf).toContain('classId');
    expect(acf).toContain('streamId');
    expect(acf).toMatch(/in-place|placement/i);
  });

  it('OpenAPI PatchEnrollmentRequest allows classId/streamId', () => {
    const oas = readFileSync(
      path.join(
        root,
        'docs/engineering/api-contract-freeze/openapi/acf-008-009-enrollments-attendance.openapi.yaml',
      ),
      'utf8',
    );
    expect(oas).toContain('ACF-008 rev 1.4');
    expect(oas).toMatch(/PatchEnrollmentRequest:[\s\S]*classId/);
    expect(oas).toMatch(/PatchEnrollmentRequest:[\s\S]*streamId/);
  });

  it('ships patch_enrollment migration and Nest patch placement', () => {
    const up = path.join(
      root,
      'apps/api/db/migrations/20260725030000_enrollment_patch_placement.up.sql',
    );
    expect(existsSync(up)).toBe(true);
    expect(readFileSync(up, 'utf8')).toContain('app.patch_enrollment');
    const svc = readFileSync(
      path.join(root, 'apps/api/src/modules/academic-structure/application/enrollments.service.ts'),
      'utf8',
    );
    expect(svc).toContain('parsePatchEnrollmentRequest');
    expect(svc).toContain('setClass');
    expect(svc).toContain('setStream');
  });

  it('Admin detail has transfer form without withdraw-and-recreate copy', () => {
    const detail = readFileSync(
      path.join(
        root,
        'apps/web/src/app/t/[tenantId]/admin/academic/enrollments/[enrollmentId]/page.tsx',
      ),
      'utf8',
    );
    expect(detail).toContain('Transfer');
    expect(detail).toContain('classId');
    expect(detail).toContain('streamId');
    expect(detail).not.toMatch(/withdraw and create/i);
  });

  it('has task record and manual QA', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-018-enrollment-transfer.md')),
    ).toBe(true);
    expect(existsSync(path.join(root, 'tasks/manual-test-enrollment-transfer-qa.md'))).toBe(true);
  });
});
