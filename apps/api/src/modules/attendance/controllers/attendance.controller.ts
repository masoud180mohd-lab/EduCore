import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
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
import { AttendanceSessionsService } from '../application/attendance-sessions.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

/**
 * Attendance sessions surface (ACF-009).
 *
 * GET  /api/v1/attendance-sessions              — list (attendance.read)
 * POST /api/v1/attendance-sessions              — create (attendance.manage)
 * GET  /api/v1/attendance-sessions/:id          — detail (attendance.read)
 * POST /api/v1/attendance-sessions/:id/close    — close (attendance.manage)
 * GET  /api/v1/attendance-sessions/:id/records  — list records (attendance.read)
 * PUT  /api/v1/attendance-sessions/:id/records  — bulk upsert (attendance.manage)
 */
@Controller('api/v1/attendance-sessions')
export class AttendanceController {
  constructor(private readonly sessionsService: AttendanceSessionsService) {}

  @Get()
  @UseGuards(RequirePermission('attendance.read'))
  async list(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('classId') classId?: string,
    @Query('sessionDate') sessionDate?: string,
    @Query('status') status?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) throw AppError.unauthorized();
    if (tenant === undefined) throw AppError.tenantContextRequired();
    return this.sessionsService.listForTenant(auth.userId, tenant.tenantId, {
      limit,
      cursor,
      classId,
      sessionDate,
      status,
    });
  }

  @Post()
  @HttpCode(201)
  @UseGuards(RequirePermission('attendance.manage'))
  async create(
    @Req() request: AuthedRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) throw AppError.unauthorized();
    if (tenant === undefined) throw AppError.tenantContextRequired();
    const correlationId =
      request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';
    return this.sessionsService.createForTenant(
      auth.userId,
      tenant.tenantId,
      body,
      idempotencyKey,
      correlationId,
    );
  }

  @Get(':id')
  @UseGuards(RequirePermission('attendance.read'))
  async getById(@Req() request: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) throw AppError.unauthorized();
    if (tenant === undefined) throw AppError.tenantContextRequired();
    return this.sessionsService.getForTenant(auth.userId, tenant.tenantId, id);
  }

  @Post(':id/close')
  @UseGuards(RequirePermission('attendance.manage'))
  async close(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) throw AppError.unauthorized();
    if (tenant === undefined) throw AppError.tenantContextRequired();
    const correlationId =
      request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';
    return this.sessionsService.closeForTenant(
      auth.userId,
      tenant.tenantId,
      id,
      idempotencyKey,
      correlationId,
    );
  }

  @Get(':id/records')
  @UseGuards(RequirePermission('attendance.read'))
  async listRecords(@Req() request: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) throw AppError.unauthorized();
    if (tenant === undefined) throw AppError.tenantContextRequired();
    return this.sessionsService.listRecordsForTenant(auth.userId, tenant.tenantId, id);
  }

  @Put(':id/records')
  @UseGuards(RequirePermission('attendance.manage'))
  async upsertRecords(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) throw AppError.unauthorized();
    if (tenant === undefined) throw AppError.tenantContextRequired();
    const correlationId =
      request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';
    return this.sessionsService.upsertRecordsForTenant(
      auth.userId,
      tenant.tenantId,
      id,
      body,
      idempotencyKey,
      correlationId,
    );
  }
}
