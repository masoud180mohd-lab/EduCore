import { Inject, Injectable, Optional } from '@nestjs/common';

import type { AuthContext } from './auth-context.js';
import type { TokenValidator } from './token-validator.js';

/**
 * Minimal session lookup surface used by SessionTokenValidator.
 * Implemented by Identity SessionRepository; avoids common→modules dependency.
 */
export interface SessionAccessLookup {
  findByAccessTokenHash(hash: string): Promise<{
    readonly id: string;
    readonly userId: string;
    readonly tenantId: string;
    readonly status: string;
    readonly expiresAt: Date;
  } | null>;
  touchSession(sessionId: string): Promise<void>;
}

export const SESSION_ACCESS_LOOKUP = Symbol('SESSION_ACCESS_LOOKUP');

export type TokenHasher = (rawToken: string) => string;

/**
 * Validates opaque access tokens against the sessions store (IMP-001 P3).
 * Fail-closed when lookup is unavailable or session inactive/expired.
 */
@Injectable()
export class SessionTokenValidator implements TokenValidator {
  constructor(
    @Optional()
    @Inject(SESSION_ACCESS_LOOKUP)
    private readonly lookup: SessionAccessLookup | null,
    private readonly hashToken: TokenHasher,
  ) {}

  async validateAccessToken(accessToken: string): Promise<AuthContext | null> {
    if (this.lookup === null || accessToken.trim() === '') {
      return null;
    }

    const hash = this.hashToken(accessToken);
    let session: Awaited<ReturnType<SessionAccessLookup['findByAccessTokenHash']>>;
    try {
      session = await this.lookup.findByAccessTokenHash(hash);
    } catch {
      return null;
    }

    if (session === null) {
      return null;
    }
    if (session.status !== 'active') {
      return null;
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    // Best-effort last_seen; ignore failures so auth still succeeds.
    void this.lookup.touchSession(session.id).catch(() => undefined);

    return {
      userId: session.userId,
      sessionId: session.id,
      tenantId: session.tenantId,
      tokenType: 'bearer',
    };
  }
}
