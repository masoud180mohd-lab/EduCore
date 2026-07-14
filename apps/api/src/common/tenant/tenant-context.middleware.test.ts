import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../errors/app-error.js';
import { TENANT_CONTEXT_REQUEST_KEY } from './tenant.constants.js';
import { TenantContextMiddleware } from './tenant-context.middleware.js';
import type { RequestWithTenant } from './tenant-context.middleware.js';

function mockRequest(headers: Record<string, string | undefined>): RequestWithTenant {
  return {
    header: (name: string) => headers[name.toLowerCase()] ?? headers[name],
  } as unknown as RequestWithTenant;
}

describe('TenantContextMiddleware', () => {
  it('leaves context unset when header missing', () => {
    const mw = new TenantContextMiddleware();
    const req = mockRequest({});
    const next = vi.fn();
    mw.use(req, {} as never, next);
    expect(req[TENANT_CONTEXT_REQUEST_KEY]).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('attaches lowercased UUID tenant id', () => {
    const mw = new TenantContextMiddleware();
    const tenantId = '01900000-0000-7000-8000-0000000000AA';
    const req = mockRequest({ 'x-tenant-id': tenantId });
    const next = vi.fn();
    mw.use(req, {} as never, next);
    expect(req[TENANT_CONTEXT_REQUEST_KEY]).toEqual({
      tenantId: tenantId.toLowerCase(),
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects invalid tenant UUID with TENANT_CONTEXT_REQUIRED', () => {
    const mw = new TenantContextMiddleware();
    const req = mockRequest({ 'x-tenant-id': 'not-a-uuid' });
    const next = vi.fn();
    mw.use(req, {} as never, next);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AppError);
    expect((next.mock.calls[0]?.[0] as AppError).code).toBe('TENANT_CONTEXT_REQUIRED');
  });
});
