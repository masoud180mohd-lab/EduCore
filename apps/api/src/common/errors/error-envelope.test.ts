import { describe, expect, it } from 'vitest';

import { AppError } from './app-error.js';
import { buildErrorEnvelope } from './error-envelope.js';

describe('ACF-001 error envelope', () => {
  it('builds requestId-canonical envelope without correlationId body field', () => {
    const envelope = buildErrorEnvelope({
      code: 'VALIDATION_ERROR',
      message: 'Invalid input.',
      requestId: '0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d',
      details: { fields: [{ path: 'email', issue: 'invalid_format' }] },
    });

    expect(envelope).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input.',
        requestId: '0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d',
        details: { fields: [{ path: 'email', issue: 'invalid_format' }] },
      },
    });
    expect(envelope.error).not.toHaveProperty('correlationId');
  });

  it('maps platform AppError codes to expected HTTP statuses', () => {
    expect(AppError.unauthorized().statusCode).toBe(401);
    expect(AppError.forbidden().statusCode).toBe(403);
    expect(AppError.tenantContextRequired().code).toBe('TENANT_CONTEXT_REQUIRED');
    expect(AppError.tenantContextRequired().statusCode).toBe(400);
    expect(AppError.tenantMembershipRequired().statusCode).toBe(403);
    expect(new AppError('IDEMPOTENCY_KEY_REUSE_MISMATCH', 'mismatch').statusCode).toBe(409);
  });
});
