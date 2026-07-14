import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/app-error.js';
import {
  assertIdempotencyKey,
  buildIdempotencyScopeKey,
  hashRequestBody,
  InMemoryIdempotencyStore,
  resolveIdempotentReplay,
} from './idempotency.js';

describe('idempotency helpers', () => {
  it('requires a well-formed Idempotency-Key', () => {
    expect(() => assertIdempotencyKey(undefined)).toThrow(AppError);
    expect(() => assertIdempotencyKey('short')).toThrow(AppError);
    expect(assertIdempotencyKey('0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d')).toHaveLength(36);
  });

  it('scopes keys to actor + tenant + route and detects body mismatch', async () => {
    const store = new InMemoryIdempotencyStore();
    const scopeKey = buildIdempotencyScopeKey(
      {
        actorUserId: 'u1',
        tenantId: 't1',
        method: 'POST',
        route: '/api/v1/tenants',
      },
      'idem-key-abcdefgh',
    );

    const bodyHash = hashRequestBody('{"name":"A"}');
    await store.put(scopeKey, {
      bodyHash,
      statusCode: 201,
      responseBody: '{"id":"1"}',
      createdAt: new Date().toISOString(),
    });

    const replay = await resolveIdempotentReplay(store, scopeKey, bodyHash);
    expect(replay?.statusCode).toBe(201);

    await expect(
      resolveIdempotentReplay(store, scopeKey, hashRequestBody('{"name":"B"}')),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSE_MISMATCH' });
  });
});
