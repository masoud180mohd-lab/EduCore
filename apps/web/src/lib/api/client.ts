/**
 * Thin typed fetch client for Nest ACF envelopes.
 * Always sends Bearer + X-Tenant-Id after bind; Idempotency-Key on mutations when provided.
 */

export type ApiError = {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.status = error.status;
    this.code = error.code;
    if (error.details !== undefined) this.details = error.details;
  }
}

export type SessionAuth = {
  readonly accessToken: string;
  readonly tenantId: string;
};

export type RequestOptions = {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  readonly auth?: SessionAuth | null;
  readonly idempotencyKey?: string;
  readonly requireTenant?: boolean;
};

function apiBase(): string {
  const raw = process.env['NEXT_PUBLIC_API_BASE_URL']?.trim();
  if (raw === undefined || raw === '') {
    return 'http://127.0.0.1:3000';
  }
  return raw.replace(/\/$/, '');
}

export function teacherFriendlyMessage(error: ApiClientError): string {
  if (error.status === 401) return 'Sign in again.';
  if (error.status === 403) return 'You do not have access for this school.';
  if (error.status === 404) return 'Not found.';
  if (error.status === 409 && /closed/i.test(error.message)) {
    return 'Session is closed — marking is disabled.';
  }
  if (error.status === 409) return error.message;
  if (error.code === 'IDEMPOTENCY_KEY_REQUIRED') {
    return 'Save failed — retry key missing. Try again.';
  }
  if (error.status === 0) return 'You are offline — queue not enabled yet.';
  return error.message;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.auth !== undefined && options.auth !== null) {
    headers['Authorization'] = `Bearer ${options.auth.accessToken}`;
    const requireTenant = options.requireTenant !== false;
    if (requireTenant) {
      headers['X-Tenant-Id'] = options.auth.tenantId;
    }
  }
  if (options.idempotencyKey !== undefined) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  let response: Response;
  try {
    const init: RequestInit = { method, headers };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }
    response = await fetch(`${apiBase()}${path}`, init);
  } catch {
    throw new ApiClientError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Network request failed.',
    });
  }

  const text = await response.text();
  let json: unknown = null;
  if (text !== '') {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const envelope = json as {
      error?: { code?: string; message?: string; details?: Record<string, unknown> };
    } | null;
    throw new ApiClientError({
      status: response.status,
      code: envelope?.error?.code ?? 'HTTP_ERROR',
      message: envelope?.error?.message ?? `Request failed (${String(response.status)}).`,
      ...(envelope?.error?.details === undefined ? {} : { details: envelope.error.details }),
    });
  }

  return json as T;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
