import type { AppErrorCode } from './app-error.js';

/**
 * ACF-001 client error envelope.
 * `requestId` is canonical (fed from correlation / request ID middleware).
 * Never include stacks, SQL, or secrets.
 */
export type ErrorEnvelope = {
  readonly error: {
    readonly code: AppErrorCode | 'INTERNAL_ERROR';
    readonly message: string;
    readonly requestId: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
};

export function buildErrorEnvelope(input: {
  code: AppErrorCode | 'INTERNAL_ERROR';
  message: string;
  requestId: string;
  details?: Readonly<Record<string, unknown>>;
}): ErrorEnvelope {
  return {
    error: {
      code: input.code,
      message: input.message,
      requestId: input.requestId,
      ...(input.details === undefined ? {} : { details: input.details }),
    },
  };
}
