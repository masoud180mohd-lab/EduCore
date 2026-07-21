import type { SessionAuth } from '../api/client.js';

const TOKEN_KEY = 'educore.accessToken';
const TENANT_KEY = 'educore.tenantId';

/** sessionStorage only — see DSF-001 threat note. */
export function readSession(): SessionAuth | null {
  if (typeof window === 'undefined') return null;
  const accessToken = sessionStorage.getItem(TOKEN_KEY);
  const tenantId = sessionStorage.getItem(TENANT_KEY);
  if (accessToken === null || tenantId === null || accessToken === '' || tenantId === '') {
    return null;
  }
  return { accessToken, tenantId };
}

export function writeSession(auth: SessionAuth): void {
  sessionStorage.setItem(TOKEN_KEY, auth.accessToken);
  sessionStorage.setItem(TENANT_KEY, auth.tenantId);
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TENANT_KEY);
}

const IDEM_PREFIX = 'educore.idem.';

export function readOrCreateIdempotencyKey(actionKey: string): string {
  const storageKey = `${IDEM_PREFIX}${actionKey}`;
  const existing = sessionStorage.getItem(storageKey);
  if (existing !== null && existing !== '') return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(storageKey, created);
  return created;
}

export function clearIdempotencyKey(actionKey: string): void {
  sessionStorage.removeItem(`${IDEM_PREFIX}${actionKey}`);
}
