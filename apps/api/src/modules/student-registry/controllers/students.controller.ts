import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/index.js';
import type { AuthContext } from '../../../common/auth/auth-context.js';
import {
  CORRELATION_ID_REQUEST_KEY,
  REQUEST_ID_REQUEST_KEY,
} from '../../../common/correlation/correlation.constants.js';
import { AppError } from '../../../common/errors/app-error.js';
import { IDEMPOTENCY_KEY_HEADER } from '../../../common/idempotency/index.js';
import { RequirePermission } from '../../../common/policy/index.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import type { TenantContext } from '../../../common/tenant/tenant-context.js';
import { StudentsService } from '../application/students.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

/**
 * Product students surface (Student Registry — ACF-002 rev 1.3).
 *
 * GET   /api/v1/students      — list (student.read) — IMP-002-P0
 * POST  /api/v1/students      — create (student.manage) — IMP-002-P2
 * GET   /api/v1/students/:id  — detail (student.read) — IMP-002-P1
 * PATCH /api/v1/students/:id  — patch (student.manage) — IMP-002-P3
 * No DELETE.
 *
 * List query: limit, cursor, status, search.
 * List response: { data, page: { nextCursor, limit } }.
 * Detail/create/patch response: { data: Student }.
 */
@Controller('api/v1/students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @UseGuards(RequirePermission('student.read'))
  async list(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw AppError.unauthorized();
    }
    if (tenant === undefined) {
      throw AppError.tenantContextRequired();
    }

    // RequirePermission already enforced session↔header bind + student.read.
    return this.studentsService.listForTenant(auth.userId, tenant.tenantId, {
      limit,
      cursor,
      status,
      search,
    });
  }

  @Get('summary')
  @UseGuards(RequirePermission('student.read'))
  async summary(@Req() request: AuthedRequest): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) throw AppError.unauthorized();
    if (tenant === undefined) throw AppError.tenantContextRequired();
    return this.studentsService.summarizeForTenant(auth.userId, tenant.tenantId);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(RequirePermission('student.manage'))
  async create(
    @Req() request: AuthedRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw AppError.unauthorized();
    }
    if (tenant === undefined) {
      throw AppError.tenantContextRequired();
    }

    const correlationId =
      request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';

    return this.studentsService.createForTenant(
      auth.userId,
      tenant.tenantId,
      body,
      idempotencyKey,
      correlationId,
    );
  }

  @Get(':id')
  @UseGuards(RequirePermission('student.read'))
  async getById(@Req() request: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw AppError.unauthorized();
    }
    if (tenant === undefined) {
      throw AppError.tenantContextRequired();
    }

    // Bound tenant only; missing/cross-tenant → 404 (no enumeration).
    return this.studentsService.getForTenant(auth.userId, tenant.tenantId, id);
  }

  @Patch(':id')
  @UseGuards(RequirePermission('student.manage'))
  async patch(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw AppError.unauthorized();
    }
    if (tenant === undefined) {
      throw AppError.tenantContextRequired();
    }

    const correlationId =
      request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';

    return this.studentsService.patchForTenant(
      auth.userId,
      tenant.tenantId,
      id,
      body,
      idempotencyKey,
      correlationId,
    );
  }
}
