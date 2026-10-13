import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../apps/api/src/app.module.js';
import { TOKEN_VALIDATOR } from '../../apps/api/src/common/auth/index.js';
import {
  MapPermissionSource,
  MembershipAwarePermissionSource,
} from '../../apps/api/src/common/policy/index.js';
import {
  AllowListTenantMembershipChecker,
  TENANT_MEMBERSHIP_CHECKER,
} from '../../apps/api/src/common/tenant/index.js';
import {
  StudentsRepository,
  type StudentRow,
} from '../../apps/api/src/modules/student-registry/repositories/students.repository.js';
import { HarnessTokenValidator, harnessBearer } from './harness-token-validator.js';
import { httpCall, parseErrorBody } from './http-client.js';

const userA = '01900000-0000-7000-8000-000000000001';
const userB = '01900000-0000-7000-8000-000000000002';
const tenantA = '01900000-0000-7000-8000-0000000000aa';
const tenantB = '01900000-0000-7000-8000-0000000000bb';
const studentInA = '01900000-0000-7000-8000-0000000000b1';

const SEED_TIMESTAMP = '2026-10-13T00:00:00.000Z';

/** In-memory tenant-keyed student store mirroring the fail-closed semantics of
 *  `students.repository.ts` (every statement carries `tenant_id = $n` under FORCE RLS,
 *  so a row owned by another tenant reads as absent → service maps to 404). */
function createHarnessStudentStore() {
  const rows = new Map<string, StudentRow>();
  rows.set(studentInA, {
    id: studentInA,
    tenantId: tenantA,
    studentCode: 'STU-A001',
    displayName: 'Asha Juma',
    status: 'active',
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  });

  const getByIdForTenant = vi.fn(
    (_actorUserId: string, tenantId: string, id: string): Promise<StudentRow | null> => {
      const row = rows.get(id);
      return Promise.resolve(row !== undefined && row.tenantId === tenantId ? row : null);
    },
  );

  const createForTenant = vi.fn(
    (
      _actorUserId: string,
      tenantId: string,
      input: {
        readonly id: string;
        readonly studentCode: string | undefined;
        readonly displayName: string;
        readonly status: string;
      },
    ): Promise<StudentRow | null> => {
      const row: StudentRow = {
        id: input.id,
        tenantId,
        studentCode: input.studentCode ?? null,
        displayName: input.displayName,
        status: input.status,
        createdAt: SEED_TIMESTAMP,
        updatedAt: SEED_TIMESTAMP,
      };
      rows.set(row.id, row);
      return Promise.resolve(row);
    },
  );

  const updateForTenant = vi.fn(
    (
      _actorUserId: string,
      tenantId: string,
      id: string,
      patch: {
        readonly setDisplayName: boolean;
        readonly displayName: string | null;
        readonly setStudentCode: boolean;
        readonly studentCode: string | null;
        readonly setStatus: boolean;
        readonly status: string | null;
      },
    ): Promise<StudentRow | null> => {
      const row = rows.get(id);
      if (row === undefined || row.tenantId !== tenantId) {
        return Promise.resolve(null);
      }
      const next: StudentRow = {
        ...row,
        displayName:
          patch.setDisplayName && patch.displayName !== null ? patch.displayName : row.displayName,
        studentCode: patch.setStudentCode ? patch.studentCode : row.studentCode,
        status: patch.setStatus && patch.status !== null ? patch.status : row.status,
        updatedAt: new Date().toISOString(),
      };
      rows.set(id, next);
      return Promise.resolve(next);
    },
  );

  const listForTenant = vi.fn(
    (
      _actorUserId: string,
      tenantId: string,
    ): Promise<{
      rows: ReadonlyArray<StudentRow>;
      nextCursor: string | null;
    }> =>
      Promise.resolve({
        rows: [...rows.values()].filter((row) => row.tenantId === tenantId),
        nextCursor: null,
      }),
  );

  const fakeRepository = {
    isAvailable: () => true,
    getByIdForTenant,
    createForTenant,
    updateForTenant,
    listForTenant,
  };

  return {
    fakeRepository,
    rowIn: (tenantId: string): number =>
      [...rows.values()].filter((row) => row.tenantId === tenantId).length,
    student: (id: string): StudentRow | undefined => rows.get(id),
  };
}

/**
 * Cross-tenant WRITE-path isolation for the students vertical (ACF-002 rev 1.3 surface:
 * GET list/detail, POST create, PATCH — no DELETE). Complements product-reads-authz
 * (permission denials, single tenant) and product-students-academic.live (read-path RLS).
 *
 * Proves, with the app-layer in-memory fake (no DB): the service always scopes writes to
 * the session-bound tenant, cross-tenant targets 404 without touching the victim row,
 * the tenant↔session bind rejects before repository access, and the Idempotency-Key
 * namespace (actor|tenant|method|route|key) neither replays nor conflicts across tenants.
 * Expected codes verified against students.service.ts / app-error.ts DEFAULT_STATUS.
 * Live PostgreSQL RLS write-denial tests are a separate, later increment (not this file).
 */
describe('Cross-tenant write isolation — students (HTTP integration, no DB)', () => {
  let app: INestApplication;
  let server: Server;
  let store: ReturnType<typeof createHarnessStudentStore>;
  let createdInBId: string | undefined;

  beforeAll(async () => {
    store = createHarnessStudentStore();

    const permissionMap = new Map<string, ReadonlySet<string>>([
      [`${userA}::${tenantA}`, new Set(['student.read', 'student.manage'])],
      [`${userB}::${tenantB}`, new Set(['student.read', 'student.manage'])],
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
          { userId: userB, tenantId: tenantB },
        ]),
      )
      .overrideProvider(MembershipAwarePermissionSource.INNER)
      .useValue(new MapPermissionSource(permissionMap))
      .overrideProvider(StudentsRepository)
      .useValue(store.fakeRepository)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  const keyB1 = 'xtenant-idem-key-student-create-b1';
  const createBodyB = JSON.stringify({ displayName: 'Zawadi Mwasa', studentCode: 'STU-B001' });

  it('POST /students creates in the session-bound tenant (201), ignoring nothing from body', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/students',
      {
        'authorization': harnessBearer(userB, tenantB),
        'x-tenant-id': tenantB,
        'content-type': 'application/json',
        'idempotency-key': keyB1,
      },
      createBodyB,
    );
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as { data: StudentRow };
    createdInBId = body.data.id;
    expect(body.data.tenantId).toBe(tenantB);
    expect(store.rowIn(tenantB)).toBe(1);
    expect(store.rowIn(tenantA)).toBe(1); // seed only — victim tenant untouched
  });

  it('POST /students rejects a forged tenantId field (400) and creates no row', async () => {
    const before = store.rowIn(tenantA);
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/students',
      {
        'authorization': harnessBearer(userB, tenantB),
        'x-tenant-id': tenantB,
        'content-type': 'application/json',
        'idempotency-key': 'xtenant-idem-key-student-create-forged1',
      },
      JSON.stringify({ displayName: 'Intruder', tenantId: tenantA }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseErrorBody(response.body).error?.code).toBe('VALIDATION_ERROR');
    expect(store.rowIn(tenantA)).toBe(before);
  });

  it('PATCH /students/:id from tenant B on a tenant A student 404s and leaves the row unchanged', async () => {
    const untouched = { ...store.student(studentInA) };
    const response = await httpCall(
      server,
      'PATCH',
      `/api/v1/students/${studentInA}`,
      {
        'authorization': harnessBearer(userB, tenantB),
        'x-tenant-id': tenantB,
        'content-type': 'application/json',
      },
      JSON.stringify({ status: 'inactive', displayName: 'Hijacked' }),
    );
    expect(response.statusCode).toBe(404);
    expect(parseErrorBody(response.body).error?.code).toBe('NOT_FOUND');
    expect(store.student(studentInA)).toEqual(untouched);
    // The service must scope the write to the SESSION tenant, not the row owner.
    const scopedCall = store.fakeRepository.updateForTenant.mock.calls.at(-1);
    expect(scopedCall?.[1]).toBe(tenantB);
  });

  it('PATCH /students/:id by the owning tenant succeeds (control proving the store is mutable)', async () => {
    const response = await httpCall(
      server,
      'PATCH',
      `/api/v1/students/${studentInA}`,
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({ status: 'inactive' }),
    );
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: StudentRow };
    expect(body.data.status).toBe('inactive');
    // Restore seed state for deterministic later assertions.
    const restore = await httpCall(
      server,
      'PATCH',
      `/api/v1/students/${studentInA}`,
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
      },
      JSON.stringify({ status: 'active' }),
    );
    expect(restore.statusCode).toBe(200);
  });

  it('PATCH with session/header tenant mismatch 403s before any repository call', async () => {
    const callsBefore = store.fakeRepository.updateForTenant.mock.calls.length;
    const untouched = { ...store.student(studentInA) };
    const response = await httpCall(
      server,
      'PATCH',
      `/api/v1/students/${studentInA}`,
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantB,
        'content-type': 'application/json',
      },
      JSON.stringify({ status: 'transferred' }),
    );
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
    expect(store.fakeRepository.updateForTenant.mock.calls.length).toBe(callsBefore);
    expect(store.student(studentInA)).toEqual(untouched);
  });

  it('same Idempotency-Key + same body within tenant B replays the stored 201 (no second row)', async () => {
    const rowsBefore = store.rowIn(tenantB);
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/students',
      {
        'authorization': harnessBearer(userB, tenantB),
        'x-tenant-id': tenantB,
        'content-type': 'application/json',
        'idempotency-key': keyB1,
      },
      createBodyB,
    );
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as { data: StudentRow };
    // Replay must return the ORIGINAL creation's stored response, not just "a" row.
    expect(body.data.id).toBe(createdInBId);
    expect(store.rowIn(tenantB)).toBe(rowsBefore);
    const created = await httpCall(server, 'GET', `/api/v1/students/${body.data.id}`, {
      'authorization': harnessBearer(userB, tenantB),
      'x-tenant-id': tenantB,
    });
    expect(created.statusCode).toBe(200);
  });

  it('same Idempotency-Key from tenant A is an isolated namespace: own 201, different id, no replay of B', async () => {
    const rowsBefore = store.rowIn(tenantA);
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/students',
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
        'content-type': 'application/json',
        'idempotency-key': keyB1,
      },
      createBodyB,
    );
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as { data: StudentRow };
    expect(body.data.tenantId).toBe(tenantA);
    // Tenant A must not receive tenant B's stored response for the same key string.
    expect(createdInBId).toBeDefined();
    expect(body.data.id).not.toBe(createdInBId);
    expect(store.rowIn(tenantA)).toBe(rowsBefore + 1);
  });

  it('same tenant, same key, different body → 409 IDEMPOTENCY_KEY_REUSE_MISMATCH, row count unchanged', async () => {
    const rowsBefore = store.rowIn(tenantB);
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/students',
      {
        'authorization': harnessBearer(userB, tenantB),
        'x-tenant-id': tenantB,
        'content-type': 'application/json',
        'idempotency-key': keyB1,
      },
      JSON.stringify({ displayName: 'Different Body', studentCode: 'STU-B002' }),
    );
    expect(response.statusCode).toBe(409);
    expect(parseErrorBody(response.body).error?.code).toBe('IDEMPOTENCY_KEY_REUSE_MISMATCH');
    expect(store.rowIn(tenantB)).toBe(rowsBefore);
  });
});
