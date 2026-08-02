/** Admin deep-link paths (IMP-031). */

export function adminStudentPath(tenantId: string, studentId: string): string {
  return `/t/${tenantId}/admin/students/${studentId}`;
}

export function adminEnrollmentPath(tenantId: string, enrollmentId: string): string {
  return `/t/${tenantId}/admin/academic/enrollments/${enrollmentId}`;
}

export function adminInvoicePath(tenantId: string, invoiceId: string): string {
  return `/t/${tenantId}/admin/fees/invoices/${invoiceId}`;
}

export function adminGuardianPath(tenantId: string, guardianId: string): string {
  return `/t/${tenantId}/admin/guardians/${guardianId}`;
}

export function adminGuardianFeesPath(tenantId: string, guardianId: string): string {
  return `/t/${tenantId}/admin/guardians/${guardianId}/fees`;
}

export function adminEnrollmentsCreatePath(tenantId: string, studentId?: string | null): string {
  const base = `/t/${tenantId}/admin/academic/enrollments`;
  if (studentId === undefined || studentId === null || studentId === '') return base;
  return `${base}?studentId=${encodeURIComponent(studentId)}`;
}

export function adminInvoicesCreatePath(tenantId: string, studentId?: string | null): string {
  const base = `/t/${tenantId}/admin/fees/invoices`;
  if (studentId === undefined || studentId === null || studentId === '') return base;
  return `${base}?studentId=${encodeURIComponent(studentId)}`;
}
