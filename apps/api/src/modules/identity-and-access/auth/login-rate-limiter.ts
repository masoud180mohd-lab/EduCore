/**
 * Login rate-limit backends: Redis (optional URL) → Postgres → in-memory.
 * Prefer multi-instance stores; fail down safely without breaking login.
 */

import net from 'node:net';

export type RateLimitResult = {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
};

export interface LoginRateLimiter {
  check(key: string): Promise<RateLimitResult>;
  recordFailure(key: string): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

export const LOGIN_RATE_LIMITER = Symbol('LOGIN_RATE_LIMITER');

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

type Bucket = {
  count: number;
  windowStartedAt: number;
};

export class InMemoryLoginRateLimiter implements LoginRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
    private readonly windowMs: number = DEFAULT_WINDOW_MS,
  ) {}

  check(key: string, now: number = Date.now()): Promise<RateLimitResult> {
    const bucket = this.buckets.get(key);
    if (bucket === undefined) {
      return Promise.resolve({ allowed: true, retryAfterSeconds: 0 });
    }
    if (now - bucket.windowStartedAt >= this.windowMs) {
      this.buckets.delete(key);
      return Promise.resolve({ allowed: true, retryAfterSeconds: 0 });
    }
    if (bucket.count >= this.maxAttempts) {
      const retryAfterSeconds = Math.ceil((this.windowMs - (now - bucket.windowStartedAt)) / 1000);
      return Promise.resolve({
        allowed: false,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      });
    }
    return Promise.resolve({ allowed: true, retryAfterSeconds: 0 });
  }

  recordFailure(key: string, now: number = Date.now()): Promise<RateLimitResult> {
    const bucket = this.buckets.get(key);
    if (bucket === undefined || now - bucket.windowStartedAt >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStartedAt: now });
      return Promise.resolve({ allowed: true, retryAfterSeconds: 0 });
    }
    bucket.count += 1;
    if (bucket.count >= this.maxAttempts) {
      const retryAfterSeconds = Math.ceil((this.windowMs - (now - bucket.windowStartedAt)) / 1000);
      return Promise.resolve({
        allowed: false,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      });
    }
    return Promise.resolve({ allowed: true, retryAfterSeconds: 0 });
  }

  reset(key: string): Promise<void> {
    this.buckets.delete(key);
    return Promise.resolve();
  }

  clear(): void {
    this.buckets.clear();
  }
}

export type PgRateLimitClient = {
  query: (
    text: string,
    params?: readonly unknown[],
  ) => Promise<{ rows: Array<{ allowed: boolean; retry_after_seconds: number }> }>;
};

/** Postgres-backed limiter via app.auth_rate_limit_* SECURITY DEFINER functions. */
export class PgLoginRateLimiter implements LoginRateLimiter {
  constructor(
    private readonly client: PgRateLimitClient,
    private readonly maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
    private readonly windowSeconds: number = Math.floor(DEFAULT_WINDOW_MS / 1000),
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const result = await this.client.query(
      `SELECT allowed, retry_after_seconds FROM app.auth_rate_limit_status($1::text, $2::int, $3::int)`,
      [key, this.maxAttempts, this.windowSeconds],
    );
    const row = result.rows[0];
    return {
      allowed: row?.allowed !== false,
      retryAfterSeconds: row?.retry_after_seconds ?? 0,
    };
  }

  async recordFailure(key: string): Promise<RateLimitResult> {
    const result = await this.client.query(
      `SELECT allowed, retry_after_seconds FROM app.auth_rate_limit_record_failure($1::text, $2::int, $3::int)`,
      [key, this.maxAttempts, this.windowSeconds],
    );
    const row = result.rows[0];
    return {
      allowed: row?.allowed !== false,
      retryAfterSeconds: row?.retry_after_seconds ?? 0,
    };
  }

  async reset(key: string): Promise<void> {
    await this.client.query(`SELECT app.auth_rate_limit_reset($1::text)`, [key]);
  }
}

/** Tiny Redis RESP client (GET/INCR/PEXPIRE/PTTL/DEL) — no extra npm dependency. */
class MiniRedis {
  private socket: net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private readonly queue: Array<{
    resolve: (value: string | number | null) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly password: string | undefined,
  ) {}

  async connect(timeoutMs = 2000): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error('redis connect timeout'));
      }, timeoutMs);

      socket.once('connect', () => {
        clearTimeout(timer);
        this.socket = socket;
        socket.on('data', (chunk: Buffer) => {
          this.buffer = Buffer.from(Buffer.concat([this.buffer, chunk]));
          this.drain();
        });
        socket.on('error', (err: Error) => {
          const pending = this.queue.shift();
          pending?.reject(err);
        });
        resolve();
      });
      socket.once('error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    if (this.password !== undefined && this.password !== '') {
      await this.command(['AUTH', this.password]);
    }
  }

  async command(args: readonly string[]): Promise<string | number | null> {
    if (this.socket === null) {
      throw new Error('redis not connected');
    }
    const payload = encodeResp(args);
    return await new Promise<string | number | null>((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.socket?.write(payload);
    });
  }

  async quit(): Promise<void> {
    try {
      await this.command(['QUIT']);
    } catch {
      // ignore
    }
    this.socket?.destroy();
    this.socket = null;
  }

  private drain(): void {
    while (this.queue.length > 0) {
      const parsed = tryParseResp(this.buffer);
      if (parsed === null) {
        return;
      }
      this.buffer = parsed.rest;
      const pending = this.queue.shift();
      if (pending === undefined) {
        return;
      }
      if (parsed.error !== undefined) {
        pending.reject(new Error(parsed.error));
      } else {
        pending.resolve(parsed.value);
      }
    }
  }
}

function encodeResp(args: readonly string[]): string {
  let out = `*${String(args.length)}\r\n`;
  for (const arg of args) {
    out += `$${String(Buffer.byteLength(arg))}\r\n${arg}\r\n`;
  }
  return out;
}

function tryParseResp(buf: Buffer): {
  value: string | number | null;
  rest: Buffer;
  error?: string;
} | null {
  if (buf.length === 0) {
    return null;
  }
  const text = buf.toString('utf8');
  const type = text[0];
  if (type === undefined) {
    return null;
  }

  if (type === '+' || type === '-' || type === ':') {
    const end = text.indexOf('\r\n');
    if (end < 0) {
      return null;
    }
    const body = text.slice(1, end);
    const rest = buf.subarray(end + 2);
    if (type === '-') {
      return { value: null, rest, error: body };
    }
    if (type === ':') {
      return { value: Number(body), rest };
    }
    return { value: body, rest };
  }

  if (type === '$') {
    const headerEnd = text.indexOf('\r\n');
    if (headerEnd < 0) {
      return null;
    }
    const len = Number(text.slice(1, headerEnd));
    if (len === -1) {
      return { value: null, rest: buf.subarray(headerEnd + 2) };
    }
    const dataStart = headerEnd + 2;
    const dataEnd = dataStart + len;
    if (buf.length < dataEnd + 2) {
      return null;
    }
    const value = buf.subarray(dataStart, dataEnd).toString('utf8');
    return { value, rest: buf.subarray(dataEnd + 2) };
  }

  // Unsupported type — consume line to avoid deadlock
  const end = text.indexOf('\r\n');
  if (end < 0) {
    return null;
  }
  return { value: null, rest: buf.subarray(end + 2), error: 'unsupported redis reply' };
}

export function parseRedisUrl(url: string): {
  host: string;
  port: number;
  password: string | undefined;
} {
  const parsed = new URL(url);
  const password =
    parsed.password !== ''
      ? decodeURIComponent(parsed.password)
      : parsed.username !== '' && parsed.username !== 'default'
        ? decodeURIComponent(parsed.username)
        : undefined;
  return {
    host: parsed.hostname || '127.0.0.1',
    port: parsed.port !== '' ? Number(parsed.port) : 6379,
    password,
  };
}

export class RedisLoginRateLimiter implements LoginRateLimiter {
  private redis: MiniRedis | null = null;

  constructor(
    private readonly redisUrl: string,
    private readonly maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
    private readonly windowMs: number = DEFAULT_WINDOW_MS,
    private readonly keyPrefix: string = 'educore:login_rl:',
  ) {}

  async connect(): Promise<void> {
    const { host, port, password } = parseRedisUrl(this.redisUrl);
    const client = new MiniRedis(host, port, password);
    await client.connect();
    this.redis = client;
  }

  private key(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async check(key: string): Promise<RateLimitResult> {
    if (this.redis === null) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const rkey = this.key(key);
    const raw = await this.redis.command(['GET', rkey]);
    if (raw === null) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const count = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(count) || count < this.maxAttempts) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const ttlRaw = await this.redis.command(['PTTL', rkey]);
    const ttl = typeof ttlRaw === 'number' ? ttlRaw : Number(ttlRaw);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, ttl > 0 ? Math.ceil(ttl / 1000) : 1),
    };
  }

  async recordFailure(key: string): Promise<RateLimitResult> {
    if (this.redis === null) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const rkey = this.key(key);
    const countRaw = await this.redis.command(['INCR', rkey]);
    const count = typeof countRaw === 'number' ? countRaw : Number(countRaw);
    if (count === 1) {
      await this.redis.command(['PEXPIRE', rkey, String(this.windowMs)]);
    }
    if (count >= this.maxAttempts) {
      const ttlRaw = await this.redis.command(['PTTL', rkey]);
      const ttl = typeof ttlRaw === 'number' ? ttlRaw : Number(ttlRaw);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, ttl > 0 ? Math.ceil(ttl / 1000) : 1),
      };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  async reset(key: string): Promise<void> {
    if (this.redis === null) {
      return;
    }
    await this.redis.command(['DEL', this.key(key)]);
  }

  async close(): Promise<void> {
    await this.redis?.quit();
    this.redis = null;
  }
}

export function loadRateLimitConfig(environment: NodeJS.ProcessEnv = process.env): {
  readonly maxAttempts: number;
  readonly windowMs: number;
  readonly redisUrl: string | undefined;
} {
  const maxAttempts = parsePositiveInt(environment['EDUCORE_LOGIN_RATE_MAX'], DEFAULT_MAX_ATTEMPTS);
  const windowMs = parsePositiveInt(environment['EDUCORE_LOGIN_RATE_WINDOW_MS'], DEFAULT_WINDOW_MS);
  const redisUrl =
    environment['EDUCORE_REDIS_URL']?.trim() || environment['REDIS_URL']?.trim() || undefined;
  return {
    maxAttempts,
    windowMs,
    redisUrl: redisUrl === '' ? undefined : redisUrl,
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return fallback;
  }
  return n;
}

/**
 * Prefer Redis → Postgres → memory. Failures fall through to next backend.
 */
export async function createLoginRateLimiter(options: {
  readonly pool: PgRateLimitClient | null;
  readonly environment?: NodeJS.ProcessEnv;
}): Promise<LoginRateLimiter> {
  const env = options.environment ?? process.env;
  const config = loadRateLimitConfig(env);

  if (config.redisUrl !== undefined) {
    try {
      const redisLimiter = new RedisLoginRateLimiter(
        config.redisUrl,
        config.maxAttempts,
        config.windowMs,
      );
      await redisLimiter.connect();
      return redisLimiter;
    } catch {
      // Fall through.
    }
  }

  if (options.pool !== null) {
    try {
      await options.pool.query(
        `SELECT allowed FROM app.auth_rate_limit_status($1::text, $2::int, $3::int)`,
        ['__educore_probe__', config.maxAttempts, Math.floor(config.windowMs / 1000)],
      );
      return new PgLoginRateLimiter(
        options.pool,
        config.maxAttempts,
        Math.floor(config.windowMs / 1000),
      );
    } catch {
      // Fall through.
    }
  }

  return new InMemoryLoginRateLimiter(config.maxAttempts, config.windowMs);
}
