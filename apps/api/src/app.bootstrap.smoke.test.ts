import 'reflect-metadata';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { request as undiciRequest } from 'node:http';

import { AppModule } from './app.module.js';
import { BOUNDED_CONTEXT_MODULES, BOUNDED_CONTEXT_NAMES } from './modules/index.js';
import { HealthService } from './common/health/health.service.js';
import { IdentityAndAccessApplicationService } from './modules/identity-and-access/index.js';
import {
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
} from './common/correlation/correlation.constants.js';
import { AUDIT_PUBLISHER } from './modules/platform-operations/index.js';
import { PolicyEvaluator } from './common/policy/index.js';
import { TOKEN_VALIDATOR } from './common/auth/index.js';

async function httpGet(
  server: Server,
  path: string,
  headers: Record<string, string> = {},
): Promise<{
  statusCode: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}> {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected server to listen on a TCP port');
  }

  return await new Promise((resolve, reject) => {
    const req = undiciRequest(
      {
        host: '127.0.0.1',
        port: address.port,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: res.headers,
          });
        });
      },
    );

    req.on('error', reject);
    req.end();
  });
}

describe('PLAT-003 NestJS modular monolith skeleton', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    server = app.getHttpServer() as Server;
  }, 120_000);

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  }, 30_000);

  it('registers all fifteen bounded-context modules', () => {
    expect(BOUNDED_CONTEXT_MODULES).toHaveLength(15);
    expect(BOUNDED_CONTEXT_NAMES).toHaveLength(15);
  });

  it('resolves skeleton application services from the DI container', () => {
    const identity = app.get(IdentityAndAccessApplicationService);
    expect(identity.describeSkeleton()).toEqual({
      boundedContext: 'Identity And Access',
      ready: false,
    });
  });

  it('exposes neutral liveness and readiness endpoints', async () => {
    const health = await httpGet(server, '/health');
    expect(health.statusCode).toBe(200);
    expect(JSON.parse(health.body)).toMatchObject({
      status: 'ok',
      service: 'educore-api',
    });

    const ready = await httpGet(server, '/ready');
    expect(ready.statusCode).toBe(200);
    expect(JSON.parse(ready.body)).toMatchObject({
      status: 'ready',
      checks: { configuration: 'ok' },
    });
  });

  it('serves engineering status HTML at root (platform only)', async () => {
    const home = await httpGet(server, '/');
    expect(home.statusCode).toBe(200);
    expect(home.body).toContain('EduCore');
    expect(home.body).toContain('ADR-012');
    expect(home.body).toContain('Still closed');
  });

  it('propagates correlation and request IDs on health responses', async () => {
    const correlationId = 'plat-003-smoke-correlation';
    const health = await httpGet(server, '/health', {
      [CORRELATION_ID_HEADER]: correlationId,
    });

    expect(health.headers[CORRELATION_ID_HEADER]).toBe(correlationId);
    expect(health.headers[REQUEST_ID_HEADER]).toBe(correlationId);
  });

  it('emits both correlation headers when client omits them', async () => {
    const health = await httpGet(server, '/health');
    expect(typeof health.headers[CORRELATION_ID_HEADER]).toBe('string');
    expect(typeof health.headers[REQUEST_ID_HEADER]).toBe('string');
    expect(health.headers[CORRELATION_ID_HEADER]).toBe(health.headers[REQUEST_ID_HEADER]);
  });

  it('resolves P2 platform providers (fail-closed defaults)', () => {
    expect(app.get(PolicyEvaluator)).toBeInstanceOf(PolicyEvaluator);
    expect(app.get(TOKEN_VALIDATOR)).toBeDefined();
    expect(app.get(AUDIT_PUBLISHER)).toBeDefined();
  });

  it('rejects invalid bearer tokens without opening business routes', async () => {
    const response = await httpGet(server, '/health', {
      authorization: 'Bearer not-a-valid-token',
    });
    // Health remains public when no auth header semantics force 401 on all routes;
    // invalid token on public route still fail-closed via middleware when Authorization present.
    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body) as {
      error: { code: string; requestId: string };
    };
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.requestId).toBeTruthy();
    expect(body.error).not.toHaveProperty('correlationId');
  });

  it('keeps HealthService configuration-only with no infrastructure checks', () => {
    const healthService = app.get(HealthService);
    expect(healthService.getReadiness().checks).toEqual({ configuration: 'ok' });
  });
});
