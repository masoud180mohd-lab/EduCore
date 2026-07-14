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
import { CORRELATION_ID_HEADER } from './common/correlation/correlation.constants.js';

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers all fourteen bounded-context modules', () => {
    expect(BOUNDED_CONTEXT_MODULES).toHaveLength(14);
    expect(BOUNDED_CONTEXT_NAMES).toHaveLength(14);
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

  it('propagates correlation IDs on health responses', async () => {
    const correlationId = 'plat-003-smoke-correlation';
    const health = await httpGet(server, '/health', {
      [CORRELATION_ID_HEADER]: correlationId,
    });

    expect(health.headers[CORRELATION_ID_HEADER]).toBe(correlationId);
  });

  it('keeps HealthService configuration-only with no infrastructure checks', () => {
    const healthService = app.get(HealthService);
    expect(healthService.getReadiness().checks).toEqual({ configuration: 'ok' });
  });
});
