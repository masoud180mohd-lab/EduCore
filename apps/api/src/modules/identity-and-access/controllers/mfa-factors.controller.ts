import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AUTH_CONTEXT_REQUEST_KEY, RequireAuthGuard } from '../../../common/auth/index.js';
import type { AuthContext } from '../../../common/auth/auth-context.js';
import { AppError } from '../../../common/errors/app-error.js';
import { IDEMPOTENCY_KEY_HEADER } from '../../../common/idempotency/index.js';
import { MfaService } from '../application/mfa.service.js';
import { SessionRepository } from '../repositories/session.repository.js';
import type { Request } from 'express';

type AuthRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
};

/**
 * Self-service MFA factors (MFA-003 / ACF-001 §4.8).
 */
@Controller('api/v1/me/mfa-factors')
@UseGuards(RequireAuthGuard)
export class MfaFactorsController {
  constructor(
    private readonly mfaService: MfaService,
    private readonly sessions: SessionRepository,
  ) {}

  @Get()
  async list(@Req() request: AuthRequest): Promise<unknown> {
    const auth = requireAuth(request);
    return this.mfaService.listFactors(auth.userId);
  }

  @Post()
  @HttpCode(201)
  async begin(
    @Req() request: AuthRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const auth = requireAuth(request);
    const profile = await this.sessions.getUserProfile(auth.userId);
    if (profile === null) throw AppError.unauthorized();
    return this.mfaService.beginTotpEnrollment(auth.userId, profile.email, body, idempotencyKey);
  }

  @Post(':factorId/confirm')
  @HttpCode(200)
  async confirm(
    @Req() request: AuthRequest,
    @Param('factorId') factorId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const auth = requireAuth(request);
    return this.mfaService.confirmTotp(auth.userId, factorId, body);
  }

  @Post(':factorId/disable')
  @HttpCode(200)
  async disable(
    @Req() request: AuthRequest,
    @Param('factorId') factorId: string,
  ): Promise<unknown> {
    const auth = requireAuth(request);
    return this.mfaService.disableFactor(auth.userId, factorId);
  }
}

function requireAuth(request: AuthRequest): AuthContext {
  const auth = request[AUTH_CONTEXT_REQUEST_KEY];
  if (auth === undefined) throw AppError.unauthorized();
  return auth;
}
