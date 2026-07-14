/**
 * Stable machine-readable error codes (ACF-001 / platform).
 * Prefer specific codes over generic INTERNAL_ERROR when safe to expose.
 */
export type AppErrorCode =
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'NOT_IMPLEMENTED'
  | 'TENANT_CONTEXT_REQUIRED'
  | 'TENANT_MEMBERSHIP_REQUIRED'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'IDEMPOTENCY_KEY_REUSE_MISMATCH';

const DEFAULT_STATUS: Readonly<Record<AppErrorCode, number>> = {
  INTERNAL_ERROR: 500,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  NOT_IMPLEMENTED: 501,
  TENANT_CONTEXT_REQUIRED: 400,
  TENANT_MEMBERSHIP_REQUIRED: 403,
  IDEMPOTENCY_KEY_REQUIRED: 400,
  IDEMPOTENCY_KEY_REUSE_MISMATCH: 409,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: AppErrorCode,
    message: string,
    statusCode?: number,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode ?? DEFAULT_STATUS[code];
    this.details = details;
  }

  static unauthorized(message = 'Authentication required.'): AppError {
    return new AppError('UNAUTHORIZED', message);
  }

  static forbidden(
    message = 'Not allowed.',
    details?: Readonly<Record<string, unknown>>,
  ): AppError {
    return new AppError('FORBIDDEN', message, undefined, details);
  }

  static validation(message: string, details?: Readonly<Record<string, unknown>>): AppError {
    return new AppError('VALIDATION_ERROR', message, undefined, details);
  }

  static tenantContextRequired(message = 'X-Tenant-Id header is required.'): AppError {
    return new AppError('TENANT_CONTEXT_REQUIRED', message);
  }

  static tenantMembershipRequired(
    message = 'Active membership is required for this tenant.',
  ): AppError {
    return new AppError('TENANT_MEMBERSHIP_REQUIRED', message);
  }
}
