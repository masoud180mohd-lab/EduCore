import {
  Body,
  Controller,
  Get,
  Headers,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
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
import { MarksService } from '../application/marks.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

/**
 * Exams / exam subjects / marks product surface (IMP-008 / ACF-011).
 *
 * GET  /api/v1/exams                                    — list (marks.read)
 * POST /api/v1/exams                                    — create (marks.manage)
 * GET  /api/v1/exams/:examId                            — detail (marks.read)
 * GET  /api/v1/exams/:examId/subjects                   — list subjects (marks.read)
 * POST /api/v1/exams/:examId/subjects                   — create subject (marks.manage)
 * GET  /api/v1/exam-subjects/:examSubjectId             — detail (marks.read)
 * GET  /api/v1/exam-subjects/:examSubjectId/marks       — list marks (marks.read)
 * PUT  /api/v1/exam-subjects/:examSubjectId/marks       — upsert marks (marks.manage)
 * POST /api/v1/exam-subjects/:examSubjectId/submit      — draft→submitted (marks.manage)
 * POST /api/v1/exam-subjects/:examSubjectId/approve     — submitted→approved (marks.approve)
 */
@Controller()
export class MarksController {
  constructor(private readonly marksService: MarksService) {}

  @Get('api/v1/exams')
  @UseGuards(RequirePermission('marks.read'))
  async listExams(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('classId') classId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('status') status?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.marksService.listExamsForTenant(auth.userId, tenant.tenantId, {
      limit,
      cursor,
      classId,
      academicYearId,
      status,
    });
  }

  @Post('api/v1/exams')
  @HttpCode(201)
  @UseGuards(RequirePermission('marks.manage'))
  async createExam(
    @Req() request: AuthedRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.marksService.createExamForTenant(
      auth.userId,
      tenant.tenantId,
      body,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Get('api/v1/exams/:examId')
  @UseGuards(RequirePermission('marks.read'))
  async getExam(@Req() request: AuthedRequest, @Param('examId') examId: string): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.marksService.getExamForTenant(auth.userId, tenant.tenantId, examId);
  }

  @Get('api/v1/exams/:examId/subjects')
  @UseGuards(RequirePermission('marks.read'))
  async listExamSubjects(
    @Req() request: AuthedRequest,
    @Param('examId') examId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.marksService.listExamSubjectsForTenant(auth.userId, tenant.tenantId, examId);
  }

  @Get('api/v1/exam-subjects/:examSubjectId')
  @UseGuards(RequirePermission('marks.read'))
  async getExamSubject(
    @Req() request: AuthedRequest,
    @Param('examSubjectId') examSubjectId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.marksService.getExamSubjectForTenant(auth.userId, tenant.tenantId, examSubjectId);
  }

  @Post('api/v1/exams/:examId/subjects')
  @HttpCode(201)
  @UseGuards(RequirePermission('marks.manage'))
  async createExamSubject(
    @Req() request: AuthedRequest,
    @Param('examId') examId: string,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.marksService.createExamSubjectForTenant(
      auth.userId,
      tenant.tenantId,
      examId,
      body,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Get('api/v1/exam-subjects/:examSubjectId/marks')
  @UseGuards(RequirePermission('marks.read'))
  async listMarks(
    @Req() request: AuthedRequest,
    @Param('examSubjectId') examSubjectId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.marksService.listMarksForTenant(auth.userId, tenant.tenantId, examSubjectId);
  }

  @Put('api/v1/exam-subjects/:examSubjectId/marks')
  @UseGuards(RequirePermission('marks.manage'))
  async upsertMarks(
    @Req() request: AuthedRequest,
    @Param('examSubjectId') examSubjectId: string,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.marksService.upsertMarksForTenant(
      auth.userId,
      tenant.tenantId,
      examSubjectId,
      body,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Post('api/v1/exam-subjects/:examSubjectId/submit')
  @UseGuards(RequirePermission('marks.manage'))
  async submit(
    @Req() request: AuthedRequest,
    @Param('examSubjectId') examSubjectId: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.marksService.submitExamSubjectForTenant(
      auth.userId,
      tenant.tenantId,
      examSubjectId,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Get('api/v1/exams/:examId/report-cards')
  @UseGuards(RequirePermission('marks.read'))
  async listReportCards(
    @Req() request: AuthedRequest,
    @Param('examId') examId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.marksService.listReportCardsForExam(auth.userId, tenant.tenantId, examId);
  }

  @Get('api/v1/exams/:examId/report-cards/:studentId')
  @UseGuards(RequirePermission('marks.read'))
  async getReportCard(
    @Req() request: AuthedRequest,
    @Param('examId') examId: string,
    @Param('studentId') studentId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.marksService.getReportCardForStudent(
      auth.userId,
      tenant.tenantId,
      examId,
      studentId,
    );
  }

  @Get('api/v1/exams/:examId/report-cards/:studentId/pdf')
  @UseGuards(RequirePermission('marks.read'))
  @Header('Content-Type', 'application/pdf')
  async getReportCardPdf(
    @Req() request: AuthedRequest,
    @Param('examId') examId: string,
    @Param('studentId') studentId: string,
  ): Promise<StreamableFile> {
    const { auth, tenant } = requireAuthTenant(request);
    const pdf = await this.marksService.getReportCardPdfForStudent(
      auth.userId,
      tenant.tenantId,
      examId,
      studentId,
    );
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="report-card-${studentId.slice(0, 8)}.pdf"`,
    });
  }

  @Post('api/v1/exam-subjects/:examSubjectId/approve')
  @UseGuards(RequirePermission('marks.approve'))
  async approve(
    @Req() request: AuthedRequest,
    @Param('examSubjectId') examSubjectId: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.marksService.approveExamSubjectForTenant(
      auth.userId,
      tenant.tenantId,
      examSubjectId,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }
}

function requireAuthTenant(request: AuthedRequest): {
  readonly auth: AuthContext;
  readonly tenant: TenantContext;
} {
  const auth = request[AUTH_CONTEXT_REQUEST_KEY];
  const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
  if (auth === undefined) throw AppError.unauthorized();
  if (tenant === undefined) throw AppError.tenantContextRequired();
  return { auth, tenant };
}

function resolveCorrelationId(request: AuthedRequest): string {
  return request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';
}
