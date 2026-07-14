import type { NestMiddleware } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors/app-error.js';
import { TENANT_CONTEXT_REQUEST_KEY, TENANT_ID_HEADER } from './tenant.constants.js';
import type { TenantContext } from './tenant-context.js';
import { isUuid, parseTenantIdHeader } from './tenant-context.js';

export type RequestWithTenant = Request & {
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
};

/**
 * Parses optional X-Tenant-Id.
 * - Missing: leave unset (tenant-scoped guards enforce later).
 * - Present but invalid UUID: 400 TENANT_CONTEXT_REQUIRED / validation.
 * Does not verify membership (requires authenticated user — see guards).
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(request: RequestWithTenant, _response: Response, next: NextFunction): void {
    const raw = parseTenantIdHeader(request.header(TENANT_ID_HEADER));
    if (raw === undefined) {
      next();
      return;
    }

    if (!isUuid(raw)) {
      next(
        new AppError('TENANT_CONTEXT_REQUIRED', 'X-Tenant-Id must be a valid UUID.', 400, {
          header: TENANT_ID_HEADER,
        }),
      );
      return;
    }

    request[TENANT_CONTEXT_REQUEST_KEY] = { tenantId: raw.toLowerCase() };
    next();
  }
}
