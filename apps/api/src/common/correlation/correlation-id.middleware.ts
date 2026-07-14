import { randomUUID } from 'node:crypto';

import type { NestMiddleware } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { CORRELATION_ID_HEADER, CORRELATION_ID_REQUEST_KEY } from './correlation.constants.js';

type RequestWithCorrelation = Request & {
  [CORRELATION_ID_REQUEST_KEY]?: string;
};

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: RequestWithCorrelation, response: Response, next: NextFunction): void {
    const incomingHeader = request.header(CORRELATION_ID_HEADER);
    const correlationId =
      incomingHeader !== undefined && incomingHeader.trim() !== ''
        ? incomingHeader.trim()
        : randomUUID();

    request[CORRELATION_ID_REQUEST_KEY] = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}
