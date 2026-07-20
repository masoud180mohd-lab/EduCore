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
      [`${userA}::${tenantA}`, new Set(['organization.read', 'user.read', 'tenant.read'])],
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

  it('does not expose write routes on product controllers (structural via 404/405)', async () => {
    const response = await httpCall(
      server,
      'POST',
      '/api/v1/organizations',
      {
        'authorization': harnessBearer(userA, tenantA),
        'x-tenant-id': tenantA,
      },
      JSON.stringify({ name: 'x', orgType: 'school' }),
    );
    expect([404, 405]).toContain(response.statusCode);
  });
});
