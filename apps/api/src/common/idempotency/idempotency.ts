import { createHash } from 'node:crypto';

import { AppError } from '../errors/app-error.js';

/** ACF-001: opaque 16–128 char key (UUID or other). */
const KEY_PATTERN = /^[\w.-]{16,128}$/;

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

export type IdempotencyScope = {
  readonly actorUserId: string;
  /** Tenant UUID, or the literal `platform` for platform-scoped mutations. */
  readonly tenantId: string;
  readonly method: string;
  readonly route: string;
};

export type IdempotencyRecord = {
  readonly bodyHash: string;
  readonly statusCode: number;
  readonly responseBody: string;
  readonly createdAt: string;
};

export interface IdempotencyStore {
  get(scopeKey: string): Promise<IdempotencyRecord | null>;
  put(scopeKey: string, record: IdempotencyRecord): Promise<void>;
}

export function parseIdempotencyKey(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function assertIdempotencyKey(raw: string | undefined): string {
  const key = parseIdempotencyKey(raw);
  if (key === undefined) {
    throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.');
  }
  if (!KEY_PATTERN.test(key)) {
    throw AppError.validation('Idempotency-Key must be 16–128 characters (opaque).');
  }
  return key;
}

export function buildIdempotencyScopeKey(scope: IdempotencyScope, key: string): string {
  return [scope.actorUserId, scope.tenantId, scope.method.toUpperCase(), scope.route, key].join(
    '|',
  );
}

export function hashRequestBody(body: string | Buffer | undefined): string {
  const payload = body === undefined ? '' : typeof body === 'string' ? body : body.toString('utf8');
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * In-memory store for tests and single-process local use.
 * Production should use Redis or a dedicated DB table (IMP-001-T15).
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  get(scopeKey: string): Promise<IdempotencyRecord | null> {
    return Promise.resolve(this.records.get(scopeKey) ?? null);
  }

  put(scopeKey: string, record: IdempotencyRecord): Promise<void> {
    this.records.set(scopeKey, record);
    return Promise.resolve();
  }

  clear(): void {
    this.records.clear();
  }
}

/**
 * Replay or conflict check for a mutation.
 * @throws IDEMPOTENCY_KEY_REUSE_MISMATCH when same key, different body.
 */
export async function resolveIdempotentReplay(
  store: IdempotencyStore,
  scopeKey: string,
  bodyHash: string,
): Promise<IdempotencyRecord | null> {
  const existing = await store.get(scopeKey);
  if (existing === null) {
    return null;
  }
  if (existing.bodyHash !== bodyHash) {
    throw new AppError(
      'IDEMPOTENCY_KEY_REUSE_MISMATCH',
      'Idempotency-Key was reused with a different request body.',
    );
  }
  return existing;
}
