import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  CORRELATION_ID_HEADER,
  CORRELATION_ID_REQUEST_KEY,
} from '../correlation/correlation.constants.js';
import type { AppLogger } from '../logging/logger.js';
import { APP_LOGGER } from '../logging/logger.tokens.js';
import { AppError } from './app-error.js';
import { buildErrorEnvelope } from './error-envelope.js';

type RequestWithCorrelation = Request & {
  [CORRELATION_ID_REQUEST_KEY]?: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<RequestWithCorrelation>();

    const correlationId =
      request[CORRELATION_ID_REQUEST_KEY] ?? request.header(CORRELATION_ID_HEADER) ?? 'unknown';

    if (exception instanceof AppError) {
      response.status(exception.statusCode).json(
        buildErrorEnvelope({
          code: exception.code,
          message: exception.message,
          correlationId,
          ...(exception.details === undefined ? {} : { details: exception.details }),
        }),
      );
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = status === Number(HttpStatus.NOT_FOUND) ? 'NOT_FOUND' : 'INTERNAL_ERROR';
      response.status(status).json(
        buildErrorEnvelope({
          code,
          message: 'Request failed.',
          correlationId,
        }),
      );
      return;
    }

    this.logger.error('Unhandled exception', {
      correlationId,
      // Never attach raw exception messages or stacks to client responses.
      outcome: 'error',
    });

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      buildErrorEnvelope({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        correlationId,
      }),
    );
  }
}

export const HTTP_EXCEPTION_FILTER = {
  provide: HttpExceptionFilter,
  inject: [APP_LOGGER],
  useFactory: (logger: AppLogger) => new HttpExceptionFilter(logger),
};
