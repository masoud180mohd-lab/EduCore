import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/index.js';
import type { AuthContext } from '../../../common/auth/auth-context.js';
import { AppError } from '../../../common/errors/app-error.js';
import { RequirePermission } from '../../../common/policy/index.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import type { TenantContext } from '../../../common/tenant/tenant-context.js';
import { StudentsService } from '../application/students.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
};

/**
 * Student self-service (DSF-009 Phase 4a).
 * GET /api/v1/me/student — student.self.read
 */
@Controller()
export class StudentSelfController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('api/v1/me/student')
  @UseGuards(RequirePermission('student.self.read'))
  async meStudent(@Req() request: AuthedRequest): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) throw AppError.unauthorized();
    if (tenant === undefined) throw AppError.tenantContextRequired();
    return this.studentsService.getMeStudent(auth.userId, tenant.tenantId);
  }
}
