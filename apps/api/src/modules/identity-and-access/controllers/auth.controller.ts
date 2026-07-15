import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AUTH_CONTEXT_REQUEST_KEY, RequireAuthGuard } from '../../../common/auth/index.js';
import type { AuthContext } from '../../../common/auth/auth-context.js';
import {
  CORRELATION_ID_REQUEST_KEY,
  REQUEST_ID_REQUEST_KEY,
} from '../../../common/correlation/correlation.constants.js';
import { TENANT_ID_HEADER } from '../../../common/tenant/tenant.constants.js';
import { AuthService } from '../auth/auth.service.js';
import {
  clearRefreshCookie,
  includeRefreshTokenInBody,
  resolveRefreshToken,
  setRefreshCookie,
} from '../auth/refresh-cookie.js';

type AuthRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
  body?: Record<string, unknown>;
};

/**
 * Authentication endpoints (IMP-001 P3 + improvements).
 * Paths: /api/v1/auth/{login,refresh,logout,me,select-tenant}.
 * No tenant/user CRUD routes.
 */
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ data: unknown }> {
    const body = asRecord(request.body);
    const userAgent = request.header('user-agent');
    const headerTenantId = request.header(TENANT_ID_HEADER);
    const result = await this.authService.login({
      email: body['email'],
      password: body['password'],
      tenantId: body['tenantId'],
      idpAssertion: body['idpAssertion'],
      correlationId: resolveCorrelationId(request),
      ...(request.ip !== undefined && request.ip !== '' ? { ip: request.ip } : {}),
      ...(userAgent !== undefined && userAgent !== '' ? { userAgent } : {}),
      ...(headerTenantId !== undefined && headerTenantId !== '' ? { headerTenantId } : {}),
    });

    setRefreshCookie(response, result.refreshToken);

    return {
      data: {
        accessToken: result.accessToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
        ...(includeRefreshTokenInBody() ? { refreshToken: result.refreshToken } : {}),
        requiresMfa: result.requiresMfa,
        mfaChallengeToken: result.mfaChallengeToken,
        user: result.user,
        tenantId: result.tenantId,
      },
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body() body: Record<string, unknown>,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ data: unknown }> {
    const refreshToken = resolveRefreshToken(body['refreshToken'], request);
    const result = await this.authService.refresh(refreshToken, resolveCorrelationId(request));

    setRefreshCookie(response, result.refreshToken);

    return {
      data: {
        accessToken: result.accessToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
        ...(includeRefreshTokenInBody() ? { refreshToken: result.refreshToken } : {}),
      },
    };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(RequireAuthGuard)
  async logout(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      return;
    }
    await this.authService.logout(auth.userId, auth.sessionId, resolveCorrelationId(request));
    clearRefreshCookie(response);
    response.status(204);
  }

  @Get('me')
  @UseGuards(RequireAuthGuard)
  async me(@Req() request: AuthRequest): Promise<{ data: unknown }> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw new Error('auth context missing after guard');
    }
    const result = await this.authService.me({
      userId: auth.userId,
      ...(auth.sessionId !== undefined ? { sessionId: auth.sessionId } : {}),
      ...(auth.tenantId !== undefined ? { tenantId: auth.tenantId } : {}),
    });
    return { data: result };
  }

  @Post('select-tenant')
  @HttpCode(200)
  @UseGuards(RequireAuthGuard)
  async selectTenant(
    @Body() body: Record<string, unknown>,
    @Req() request: AuthRequest,
  ): Promise<{ data: unknown }> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw new Error('auth context missing after guard');
    }
    const result = await this.authService.selectTenant({
      userId: auth.userId,
      sessionId: auth.sessionId,
      tenantId: body['tenantId'],
      correlationId: resolveCorrelationId(request),
    });
    return { data: result };
  }
}

function resolveCorrelationId(request: AuthRequest): string {
  return request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
