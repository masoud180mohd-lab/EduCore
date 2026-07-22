import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../apps/api/src/app.module.js';
import { TOKEN_VALIDATOR } from '../../apps/api/src/common/auth/index.js';
import {
  MapPermissionSource,
  MembershipAwarePermissionSource,
  PERMISSION_SOURCE,
} from '../../apps/api/src/common/policy/index.js';
import {
  AllowListTenantMembershipChecker,
  TENANT_MEMBERSHIP_CHECKER,
} from '../../apps/api/src/common/tenant/index.js';
import { harnessBearer, HarnessTokenValidator } from './harness-token-validator.js';
import { httpCall, parseErrorBody } from './http-client.js';

const userA = '01900000-0000-7000-8000-000000000001';
const userNoPerm = '01900000-0000-7000-8000-000000000002';
const tenantA = '01900000-0000-7000-8000-0000000000aa';
const tenantB = '01900000-0000-7000-8000-0000000000bb';

/**
 * AUDIT-R4 / IMP-001 P10 — HTTP integration proving RequirePermission + session bind
 * are wired on representative product read routes (no live DB required).
 */
describe('IMP-001 P10 product reads AuthZ (HTTP integration)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const permissionMap = new Map<string, ReadonlySet<string>>([
      [
        `${userA}::${tenantA}`,
        new Set([
          'organization.read',
          'organization.manage',
          'user.read',
          'user.manage',
          'tenant.read',
          'tenant.manage',
          'user.invite',
          'student.read',
          'student.manage',
          'academic.read',
          'academic.manage',
          'attendance.read',
          'attendance.manage',
          'finance.read',
          'finance.manage',
          'finance.reconcile',
        ]),
      ],
    ]);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TOKEN_VALIDATOR)
      .useValue(new HarnessTokenValidator())
      .overrideProvider(TENANT_MEMBERSHIP_CHECKER)
      .useValue(
        new AllowListTenantMembershipChecker([
          { userId: userA, tenantId: tenantA },
          { userId: userNoPerm, tenantId: tenantA },
        ]),
      )
      .overrideProvider(MembershipAwarePermissionSource.INNER)
      .useValue(new MapPermissionSource(permissionMap))
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/tenants requires authentication', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/tenants');
    expect(response.statusCode).toBe(401);
    expect(parseErrorBody(response.body).error?.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/tenants allows auth-only list (picker)', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/tenants', {
      authorization: harnessBearer(userA, tenantA),
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/organizations returns 401 without bearer', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/organizations', {
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/v1/organizations returns 400 without X-Tenant-Id', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/organizations', {
      authorization: harnessBearer(userA, tenantA),
    });
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('TENANT_CONTEXT_REQUIRED');
  });

  it('GET /api/v1/organizations returns 403 on session/header tenant mismatch', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/organizations', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantB,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
  });

  it('GET /api/v1/organizations returns 403 without required permission', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/organizations', {
      'authorization': harnessBearer(userNoPerm, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.code).toBe('FORBIDDEN');
  });

  it('POST /api/v1/organizations returns 400 without Idempotency-Key when permitted', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/organizations',
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({ orgType: 'school', name: 'S' }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('POST /api/v1/organizations returns 403 without organization.manage', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/organizations',
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
        'idempotency-key': 'idem-key-http-org-create01',
      },
      JSON.stringify({ orgType: 'school', name: 'S' }),
    );
    expect(response.statusCode).toBe(403);
  });

  it('POST /api/v1/memberships returns 403 without user.invite', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/memberships',
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
        'idempotency-key': 'idem-key-http-membership01',
      },
      JSON.stringify({ email: 'x@example.com' }),
    );
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.code).toBe('FORBIDDEN');
  });

  it('POST /api/v1/memberships returns 400 without Idempotency-Key when permitted', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/memberships',
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({ email: 'x@example.com' }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('PUT /api/v1/tenant-settings returns 403 without tenant.manage', async () => {
    const response = await httpCall(
      server,
      'PUT',
      '/api/v1/tenant-settings',
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({ schemaVersion: 1, settings: {} }),
    );
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.code).toBe('FORBIDDEN');
  });

  it('PUT /api/v1/tenant-settings returns 403 on session/header mismatch', async () => {
    const response = await httpCall(
      server,
      'PUT',
      '/api/v1/tenant-settings',
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantB,
        'content-type': 'application/json',
      },
      JSON.stringify({ schemaVersion: 1, settings: {} }),
    );
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
  });

  it('GET /api/v1/organizations returns 200 when AuthZ passes', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/organizations', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[]; page: { limit: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.page.limit).toBe(25);
  });

  it('GET /api/v1/memberships returns 403 on session/header mismatch', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/memberships', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantB,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
  });

  it('GET /api/v1/users returns 403 on session/header mismatch', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/users', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantB,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
  });

  it('GET /api/v1/students returns 403 on session/header mismatch', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/students', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantB,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
  });

  it('GET /api/v1/students returns 403 without student.read', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/students', {
      'authorization': harnessBearer(userNoPerm, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/academic-years returns 403 on session/header mismatch', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/academic-years', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantB,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
  });

  it('GET /api/v1/academic-years returns 403 without academic.read', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/academic-years', {
      'authorization': harnessBearer(userNoPerm, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/academic-years returns 200 when AuthZ passes', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/academic-years', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[]; page: { limit: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.page.limit).toBe(25);
  });

  it('GET /api/v1/academic-years/:id returns 404 for invalid id shape (no leak)', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/academic-years/not-a-uuid', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(404);
    expect(parseErrorBody(response.body).error?.code).toBe('NOT_FOUND');
  });

  it('GET /api/v1/academic-years/:id returns 403 without academic.read', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/academic-years/${userA}`, {
      'authorization': harnessBearer(userNoPerm, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
  });

  it('POST /api/v1/academic-years returns 400 without Idempotency-Key when permitted', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/academic-years',
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({ name: '2026/2027' }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('POST /api/v1/academic-years returns 403 without academic.manage', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/academic-years',
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
        'idempotency-key': 'idem-key-http-ay-create01',
      },
      JSON.stringify({ name: '2026/2027' }),
    );
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/terms returns 403 on session/header mismatch', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/terms', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantB,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
  });

  it('GET /api/v1/terms returns 403 without academic.read', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/terms', {
      'authorization': harnessBearer(userNoPerm, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/terms returns 200 when AuthZ passes', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/terms', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[]; page: { limit: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.page.limit).toBe(25);
  });

  it('GET /api/v1/terms returns 400 for non-uuid academicYearId', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/terms?academicYearId=not-a-uuid', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/terms/:id returns 404 for invalid id shape (no leak)', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/terms/not-a-uuid', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(404);
    expect(parseErrorBody(response.body).error?.code).toBe('NOT_FOUND');
  });

  it('GET /api/v1/terms/:id returns 403 without academic.read', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/terms/${userA}`, {
      'authorization': harnessBearer(userNoPerm, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/terms/:id returns 403 on session/header mismatch', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/terms/${userA}`, {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantB,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
  });

  it('POST /api/v1/terms returns 400 without Idempotency-Key when permitted', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/terms',
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({
        academicYearId: '01900000-0000-7000-8000-0000000000c1',
        name: 'Term 1',
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('POST /api/v1/terms returns 403 without academic.manage', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/terms',
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
        'idempotency-key': 'idem-key-http-term-create01',
      },
      JSON.stringify({
        academicYearId: '01900000-0000-7000-8000-0000000000c1',
        name: 'Term 1',
      }),
    );
    expect(response.statusCode).toBe(403);
  });

  it('POST /api/v1/students returns 400 without Idempotency-Key when permitted', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/students',
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({ displayName: 'Asha' }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('POST /api/v1/students returns 403 without student.manage', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/students',
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
        'idempotency-key': 'idem-key-http-student-create01',
      },
      JSON.stringify({ displayName: 'Asha' }),
    );
    expect(response.statusCode).toBe(403);
  });

  it('PATCH /api/v1/students/:id returns 403 without student.manage', async () => {
    const response = await httpCall(
      server,
      'PATCH',
      `/api/v1/students/${userA}`,
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({ status: 'inactive' }),
    );
    expect(response.statusCode).toBe(403);
  });

  it('PATCH /api/v1/students/:id returns 404 for invalid id shape', async () => {
    const response = await httpCall(
      server,
      'PATCH',
      '/api/v1/students/not-a-uuid',
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({ status: 'inactive' }),
    );
    expect(response.statusCode).toBe(404);
    expect(parseErrorBody(response.body).error?.code).toBe('NOT_FOUND');
  });

  it('GET /api/v1/classes returns 403 without academic.read', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/classes', {
      'authorization': harnessBearer(userNoPerm, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/classes returns 200 when AuthZ passes', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/classes', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[]; page: { limit: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.page.limit).toBe(25);
  });

  it('GET /api/v1/classes/:id returns 404 for invalid id', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/classes/not-a-uuid', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(404);
  });

  it('POST /api/v1/classes returns 400 without Idempotency-Key', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/classes',
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({
        academicYearId: '01900000-0000-7000-8000-0000000000c1',
        name: 'Form 1A',
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('POST /api/v1/classes returns 403 without academic.manage', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/classes',
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
        'idempotency-key': 'idem-key-http-class-create01',
      },
      JSON.stringify({
        academicYearId: '01900000-0000-7000-8000-0000000000c1',
        name: 'Form 1A',
      }),
    );
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/streams returns 200 when AuthZ passes', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/streams', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(200);
  });

  it('GET /api/v1/streams returns 403 without academic.read', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/streams', {
      'authorization': harnessBearer(userNoPerm, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/subjects returns 200 when AuthZ passes', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/subjects', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(200);
  });

  it('POST /api/v1/subjects returns 403 without academic.manage', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/subjects',
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
        'idempotency-key': 'idem-key-http-subject-create01',
      },
      JSON.stringify({ name: 'Math' }),
    );
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/enrollments returns 200 when AuthZ passes', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/enrollments', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[]; page: { limit: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.page.limit).toBe(25);
  });

  it('GET /api/v1/enrollments returns 403 without academic.read', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/enrollments', {
      'authorization': harnessBearer(userNoPerm, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/enrollments/:id returns 404 for invalid id', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/enrollments/not-a-uuid', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(404);
  });

  it('POST /api/v1/enrollments returns 400 without Idempotency-Key', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/enrollments',
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({
        studentId: '01900000-0000-7000-8000-0000000000b1',
        classId: '01900000-0000-7000-8000-0000000000e1',
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('POST /api/v1/enrollments returns 403 without academic.manage', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/enrollments',
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
        'idempotency-key': 'idem-key-http-enrollment-create01',
      },
      JSON.stringify({
        studentId: '01900000-0000-7000-8000-0000000000b1',
        classId: '01900000-0000-7000-8000-0000000000e1',
      }),
    );
    expect(response.statusCode).toBe(403);
  });

  it('PATCH /api/v1/enrollments/:id returns 403 without academic.manage', async () => {
    const response = await httpCall(
      server,
      'PATCH',
      `/api/v1/enrollments/${userA}`,
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({ status: 'withdrawn' }),
    );
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/attendance-sessions returns 200 when AuthZ passes', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/attendance-sessions', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[]; page: { limit: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.page.limit).toBe(25);
  });

  it('GET /api/v1/attendance-sessions returns 403 without attendance.read', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/attendance-sessions', {
      'authorization': harnessBearer(userNoPerm, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/fee-structures returns 200 when finance.read passes', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/fee-structures', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/fee-structures returns 403 without finance.read', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/fee-structures', {
      'authorization': harnessBearer(userNoPerm, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/invoices returns 401 without bearer', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/invoices', {
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/v1/invoices returns 403 on session/header mismatch', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/invoices', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantB,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
  });

  it('POST /api/v1/payments returns 400 without Idempotency-Key', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/payments',
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({
        invoiceId: '01900000-0000-7000-8000-0000000000f1',
        method: 'cash',
        amountMinor: 100,
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('POST /api/v1/payments returns 403 without finance.manage', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/payments',
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
        'idempotency-key': 'idem-key-http-finance-pay-00001',
      },
      JSON.stringify({
        invoiceId: '01900000-0000-7000-8000-0000000000f1',
        method: 'cash',
        amountMinor: 100,
      }),
    );
    expect(response.statusCode).toBe(403);
  });

  it('POST /api/v1/payments/:id/reconcile returns 403 without finance.reconcile', async () => {
    const response = await httpCall(
      server,
      'POST',
      `/api/v1/payments/${userA}/reconcile`,
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'idempotency-key': 'idem-key-http-finance-rec-00001',
      },
      JSON.stringify({}),
    );
    expect(response.statusCode).toBe(403);
  });

  it('POST /api/v1/payments/:id/reconcile returns 400 without Idempotency-Key when permitted', async () => {
    const response = await httpCall(
      server,
      'POST',
      `/api/v1/payments/${userA}/reconcile`,
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
      },
      JSON.stringify({}),
    );
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('GET /api/v1/receipts returns 200 when finance.read passes', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/receipts', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(200);
  });

  it('GET /api/v1/attendance-sessions/:id returns 404 for invalid id', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/attendance-sessions/not-a-uuid', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(404);
  });

  it('POST /api/v1/attendance-sessions returns 400 without Idempotency-Key', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/attendance-sessions',
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({
        classId: '01900000-0000-7000-8000-0000000000e1',
        sessionDate: '2026-07-21',
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('POST /api/v1/attendance-sessions returns 403 without attendance.manage', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/attendance-sessions',
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
        'idempotency-key': 'idem-key-http-attendance-create01',
      },
      JSON.stringify({
        classId: '01900000-0000-7000-8000-0000000000e1',
        sessionDate: '2026-07-21',
      }),
    );
    expect(response.statusCode).toBe(403);
  });

  it('PUT /api/v1/attendance-sessions/:id/records returns 403 without attendance.manage', async () => {
    const response = await httpCall(
      server,
      'PUT',
      `/api/v1/attendance-sessions/${userA}/records`,
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
        'idempotency-key': 'idem-key-http-attendance-records01',
      },
      JSON.stringify({
        records: [{ studentId: '01900000-0000-7000-8000-0000000000b1', status: 'present' }],
      }),
    );
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/students returns 200 when AuthZ passes', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/students', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[]; page: { limit: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.page.limit).toBe(25);
  });

  it('GET /api/v1/students/:id returns 404 for invalid id shape (no leak)', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/students/not-a-uuid', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(404);
    expect(parseErrorBody(response.body).error?.code).toBe('NOT_FOUND');
  });

  it('GET /api/v1/students/:id returns 403 without student.read', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/students/${userA}`, {
      'authorization': harnessBearer(userNoPerm, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/v1/students/:id returns 403 on session/header mismatch', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/students/${userA}`, {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantB,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
  });

  it('PATCH /api/v1/users/:id returns 403 for other user without user.manage', async () => {
    const response = await httpCall(
      server,
      'PATCH',
      `/api/v1/users/${userA}`,
      {
        'authorization': harnessBearer(userNoPerm, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({ displayName: 'Nope' }),
    );
    expect(response.statusCode).toBe(403);
  });

  it('PATCH /api/v1/users/:id returns 400 when body includes status', async () => {
    const response = await httpCall(
      server,
      'PATCH',
      `/api/v1/users/${userA}`,
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({ displayName: 'X', status: 'disabled' }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/users/:id returns 401 without bearer', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/users/${userA}`, {
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(401);
    expect(parseErrorBody(response.body).error?.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/users/:id returns 400 without X-Tenant-Id', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/users/${userA}`, {
      authorization: harnessBearer(userA, tenantA),
    });
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('TENANT_CONTEXT_REQUIRED');
  });

  it('GET /api/v1/users/:id returns 403 on session/header mismatch', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/users/${userA}`, {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantB,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
  });

  it('GET /api/v1/users/:id returns 403 without user.read', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/users/${userA}`, {
      'authorization': harnessBearer(userNoPerm, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.code).toBe('FORBIDDEN');
  });

  it('GET /api/v1/users/:id returns 404 for invalid id shape (no leak)', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/users/not-a-uuid', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(404);
    expect(parseErrorBody(response.body).error?.code).toBe('NOT_FOUND');
  });

  it('GET /api/v1/users/:id returns 404 for well-formed unknown UUID (no leak)', async () => {
    const unknownUser = '01900000-0000-7000-8000-00000000dead';
    const response = await httpCall(server, 'GET', `/api/v1/users/${unknownUser}`, {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(404);
    expect(parseErrorBody(response.body).error?.code).toBe('NOT_FOUND');
  });

  it('GET /api/v1/tenants/:id returns 403 when path tenant differs from X-Tenant-Id', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/tenants/${tenantB}`, {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe('TENANT_PATH_MISMATCH');
  });

  it('GET /api/v1/organizations/:id returns 404 for invalid id shape (no leak)', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/organizations/not-a-uuid', {
      'authorization': harnessBearer(userA, tenantA),
      'x-tenant-id': tenantA,
    });
    expect(response.statusCode).toBe(404);
    expect(parseErrorBody(response.body).error?.code).toBe('NOT_FOUND');
  });

  it('wires MembershipAwarePermissionSource in the DI graph', () => {
    expect(app.get(PERMISSION_SOURCE)).toBeInstanceOf(MembershipAwarePermissionSource);
  });

  it('does not expose non-gated writes (org PATCH/deactivate, user disable)', async () => {
    const orgPatch = await httpCall(
      server,
      'PATCH',
      `/api/v1/organizations/${tenantA}`,
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({ name: 'x' }),
    );
    expect([404, 405]).toContain(orgPatch.statusCode);

    const userDisable = await httpCall(
      server,
      'POST',
      `/api/v1/users/${userA}/disable`,
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
      },
      JSON.stringify({}),
    );
    expect([404, 405]).toContain(userDisable.statusCode);
  });
});
