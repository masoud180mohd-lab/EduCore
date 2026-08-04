/**
 * MFA_ENFORCE=hard continuous gate for privileged permission routes.
 */
import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import type { PrivilegedMfaGate } from '../../../common/policy/privileged-mfa-gate.js';
import {
  PRIVILEGED_MFA_PERMISSIONS,
  resolveMfaEnforceMode,
} from './mfa-crypto.js';
import { MfaRepository } from '../repositories/mfa.repository.js';

@Injectable()
export class HardPrivilegedMfaGate implements PrivilegedMfaGate {
  constructor(private readonly mfa: MfaRepository) {}

  async assertAccess(
    userId: string,
    _tenantId: string,
    routePermissions: ReadonlyArray<string>,
  ): Promise<void> {
    if (resolveMfaEnforceMode() !== 'hard') return;

    const privilegedRoute = routePermissions.some((code) =>
      (PRIVILEGED_MFA_PERMISSIONS as readonly string[]).includes(code),
    );
    if (!privilegedRoute) return;

    if (!this.mfa.isAvailable()) {
      throw new AppError(
        'MFA_REQUIRED',
        'MFA store unavailable; privileged action denied (MFA_ENFORCE=hard).',
      );
    }

    const hasTotp = await this.mfa.hasActiveTotp(userId);
    if (!hasTotp) {
      throw new AppError(
        'MFA_REQUIRED',
        'Privileged action requires enrolled TOTP (MFA_ENFORCE=hard).',
      );
    }
  }
}
