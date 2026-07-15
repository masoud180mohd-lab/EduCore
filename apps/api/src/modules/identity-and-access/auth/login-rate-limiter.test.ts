import { describe, expect, it, vi } from 'vitest';

import {
  createLoginRateLimiter,
  InMemoryLoginRateLimiter,
  parseRedisUrl,
  PgLoginRateLimiter,
} from './login-rate-limiter.js';

describe('login rate limiters', () => {
  it('in-memory blocks after max attempts', async () => {
    const limiter = new InMemoryLoginRateLimiter(2, 60_000);
    await expect(limiter.check('k')).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
    await limiter.recordFailure('k');
    await limiter.recordFailure('k');
    await expect(limiter.check('k')).resolves.toMatchObject({ allowed: false });
    await limiter.reset('k');
    await expect(limiter.check('k')).resolves.toMatchObject({ allowed: true });
  });

  it('Pg limiter maps SQL rows', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ allowed: true, retry_after_seconds: 0 }] })
        .mockResolvedValueOnce({ rows: [{ allowed: false, retry_after_seconds: 30 }] }),
    };
    const limiter = new PgLoginRateLimiter(client, 10, 900);
    await expect(limiter.check('a')).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
    await expect(limiter.recordFailure('a')).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 30,
    });
  });

  it('parses redis URLs with password', () => {
    expect(parseRedisUrl('redis://:secret@127.0.0.1:6379/0')).toEqual({
      host: '127.0.0.1',
      port: 6379,
      password: 'secret',
    });
  });

  it('createLoginRateLimiter falls back to memory when no backends', async () => {
    const limiter = await createLoginRateLimiter({
      pool: null,
      environment: {},
    });
    expect(limiter).toBeInstanceOf(InMemoryLoginRateLimiter);
  });

  it('createLoginRateLimiter prefers postgres when probe succeeds', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ allowed: true }] }),
    };
    const limiter = await createLoginRateLimiter({
      pool,
      environment: {},
    });
    expect(limiter).toBeInstanceOf(PgLoginRateLimiter);
  });
});
