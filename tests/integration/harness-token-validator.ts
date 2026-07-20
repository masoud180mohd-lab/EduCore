import type { AuthContext } from '../../apps/api/src/common/auth/auth-context.js';
import type { TokenValidator } from '../../apps/api/src/common/auth/token-validator.js';

/**
 * Test harness token: `harness:<userId>:<sessionTenantId>`.
 * Use `_` as sessionTenantId for an unbound session.
 * Never register outside integration / live HTTP tests.
 */
export class HarnessTokenValidator implements TokenValidator {
  validateAccessToken(accessToken: string): Promise<AuthContext | null> {
    if (!accessToken.startsWith('harness:')) {
      return Promise.resolve(null);
    }

    const payload = accessToken.slice('harness:'.length);
    const separator = payload.indexOf(':');
    if (separator <= 0) {
      return Promise.resolve(null);
    }

    const userId = payload.slice(0, separator).trim();
    const tenantToken = payload.slice(separator + 1).trim();
    if (userId === '') {
      return Promise.resolve(null);
    }

    const context: AuthContext = {
      userId,
      sessionId: 'harness-session',
      tokenType: 'bearer',
    };

    if (tenantToken !== '' && tenantToken !== '_') {
      return Promise.resolve({ ...context, tenantId: tenantToken });
    }

    return Promise.resolve(context);
  }
}

export function harnessBearer(userId: string, sessionTenantId: string): string {
  return `Bearer harness:${userId}:${sessionTenantId}`;
}
