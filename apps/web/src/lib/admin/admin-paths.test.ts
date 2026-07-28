import { describe, expect, it } from 'vitest';

import {
  adminEnrollmentPath,
  adminGuardianFeesPath,
  adminGuardianPath,
  adminInvoicePath,
  adminStudentPath,
} from './admin-paths.js';

describe('admin-paths', () => {
  const tenantId = '01900000-0010-7000-8000-000000000001';
  const id = '01900000-0000-7000-8000-0000000000aa';

  it('builds student, enrollment, invoice, guardian paths', () => {
    expect(adminStudentPath(tenantId, id)).toBe(`/t/${tenantId}/admin/students/${id}`);
    expect(adminEnrollmentPath(tenantId, id)).toBe(
      `/t/${tenantId}/admin/academic/enrollments/${id}`,
    );
    expect(adminInvoicePath(tenantId, id)).toBe(`/t/${tenantId}/admin/fees/invoices/${id}`);
    expect(adminGuardianPath(tenantId, id)).toBe(`/t/${tenantId}/admin/guardians/${id}`);
    expect(adminGuardianFeesPath(tenantId, id)).toBe(`/t/${tenantId}/admin/guardians/${id}/fees`);
  });
});
