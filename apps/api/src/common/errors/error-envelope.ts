import type { AppErrorCode } from './app-error.js';

/**
 * Neutral HTTP error envelope.
 * Domain-specific error catalogues remain deferred until API Contract Freeze.
 */
export type ErrorEnvelope = {
  readonly error: {
    readonly code: AppErrorCode | 'INTERNAL_ERROR';
    readonly message: string;
    readonly correlationId: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
};

export function buildErrorEnvelope(input: {
  code: AppErrorCode | 'INTERNAL_ERROR';
  message: string;
  correlationId: string;
  details?: Readonly<Record<string, unknown>>;
}): ErrorEnvelope {
  return {
    error: {
      code: input.code,
      message: input.message,
      correlationId: input.correlationId,
      ...(input.details === undefined ? {} : { details: input.details }),
    },
  };
}
