import type { NestMiddleware } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors/app-error.js';
import { AUTH_CONTEXT_REQUEST_KEY, AUTHORIZATION_HEADER } from './auth.constants.js';
import type { AuthContext } from './auth-context.js';
import { extractBearerToken } from './auth-context.js';
import type { TokenValidator } from './token-validator.js';
import { TOKEN_VALIDATOR } from './token-validator.js';

export type RequestWithAuth = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
};

/**
 * If Authorization is present, validate Bearer token and attach AuthContext.
 * Missing Authorization is allowed (public routes / later guards).
 * Malformed scheme or invalid token → 401 UNAUTHORIZED.
 */
@Injectable()
export class AuthContextMiddleware implements NestMiddleware {
  constructor(@Inject(TOKEN_VALIDATOR) private readonly tokenValidator: TokenValidator) {}

  async use(request: RequestWithAuth, _response: Response, next: NextFunction): Promise<void> {
    const header = request.header(AUTHORIZATION_HEADER);
    if (header === undefined || header.trim() === '') {
      next();
      return;
    }

    const token = extractBearerToken(header);
    if (token === undefined) {
      next(AppError.unauthorized('Authorization must be a Bearer token.'));
      return;
    }

    try {
      const principal = await this.tokenValidator.validateAccessToken(token);
      if (principal === null) {
        next(AppError.unauthorized('Invalid or expired credentials.'));
        return;
      }
      request[AUTH_CONTEXT_REQUEST_KEY] = principal;
      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      next(AppError.unauthorized('Invalid or expired credentials.'));
    }
  }
}
