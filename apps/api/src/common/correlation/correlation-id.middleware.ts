import { randomUUID } from 'node:crypto';

import type { NestMiddleware } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import {
  CORRELATION_ID_HEADER,
  CORRELATION_ID_REQUEST_KEY,
  REQUEST_ID_HEADER,
  REQUEST_ID_REQUEST_KEY,
} from './correlation.constants.js';

export type RequestWithCorrelation = Request & {
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

function resolveIncomingId(request: Request, headerName: string): string | undefined {
  const raw = request.header(headerName);
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Accepts optional X-Correlation-Id; always emits X-Correlation-Id and X-Request-Id.
 * When only correlation is provided, request id mirrors it (ACF-001).
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: RequestWithCorrelation, response: Response, next: NextFunction): void {
    const incomingCorrelation = resolveIncomingId(request, CORRELATION_ID_HEADER);
    const incomingRequestId = resolveIncomingId(request, REQUEST_ID_HEADER);

    const correlationId = incomingCorrelation ?? incomingRequestId ?? randomUUID();
    const requestId = incomingRequestId ?? correlationId;

    request[CORRELATION_ID_REQUEST_KEY] = correlationId;
    request[REQUEST_ID_REQUEST_KEY] = requestId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
