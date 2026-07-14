import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  CORRELATION_ID_HEADER,
  CORRELATION_ID_REQUEST_KEY,
  REQUEST_ID_HEADER,
  REQUEST_ID_REQUEST_KEY,
} from '../correlation/correlation.constants.js';
import type { AppLogger } from '../logging/logger.js';
import { APP_LOGGER } from '../logging/logger.tokens.js';
import { AppError } from './app-error.js';
import { buildErrorEnvelope } from './error-envelope.js';

type RequestWithIds = Request & {
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

function resolveRequestId(request: RequestWithIds): string {
  return (
    request[REQUEST_ID_REQUEST_KEY] ??
    request[CORRELATION_ID_REQUEST_KEY] ??
    request.header(REQUEST_ID_HEADER) ??
    request.header(CORRELATION_ID_HEADER) ??
    'unknown'
  );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<RequestWithIds>();

    const requestId = resolveRequestId(request);
    const correlationId =
      request[CORRELATION_ID_REQUEST_KEY] ?? request.header(CORRELATION_ID_HEADER) ?? requestId;

    // Ensure support headers are present even when middleware did not run.
    if (!response.getHeader(CORRELATION_ID_HEADER)) {
      response.setHeader(CORRELATION_ID_HEADER, correlationId);
    }
    if (!response.getHeader(REQUEST_ID_HEADER)) {
      response.setHeader(REQUEST_ID_HEADER, requestId);
    }

    if (exception instanceof AppError) {
      response.status(exception.statusCode).json(
        buildErrorEnvelope({
          code: exception.code,
          message: exception.message,
          requestId,
          ...(exception.details === undefined ? {} : { details: exception.details }),
        }),
      );
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code =
        status === Number(HttpStatus.NOT_FOUND)
          ? 'NOT_FOUND'
          : status === Number(HttpStatus.UNAUTHORIZED)
            ? 'UNAUTHORIZED'
            : status === Number(HttpStatus.FORBIDDEN)
              ? 'FORBIDDEN'
              : status === Number(HttpStatus.BAD_REQUEST)
                ? 'VALIDATION_ERROR'
                : status === Number(HttpStatus.CONFLICT)
                  ? 'CONFLICT'
                  : 'INTERNAL_ERROR';
      response.status(status).json(
        buildErrorEnvelope({
          code,
          message: 'Request failed.',
          requestId,
        }),
      );
      return;
    }

    this.logger.error('Unhandled exception', {
      requestId,
      correlationId,
      // Never attach raw exception messages or stacks to client responses.
      outcome: 'error',
    });

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      buildErrorEnvelope({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        requestId,
      }),
    );
  }
}

export const HTTP_EXCEPTION_FILTER = {
  provide: HttpExceptionFilter,
  inject: [APP_LOGGER],
  useFactory: (logger: AppLogger) => new HttpExceptionFilter(logger),
};
