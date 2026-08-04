/**
 * Continuous privileged MFA gate (MFA hard-enforce).
 * Soft / default: no-op. Hard implementation provided by Identity module.
 */
import { Injectable } from '@nestjs/common';

import { AppError } from '../errors/app-error.js';

export interface PrivilegedMfaGate {
  /**
   * When MFA_ENFORCE=hard and `routePermissions` touches privileged codes,
   * require an active TOTP (fail closed if MFA store unavailable).
   */
  assertAccess(
    userId: string,
    tenantId: string,
    routePermissions: ReadonlyArray<string>,
  ): Promise<void>;
}

export const PRIVILEGED_MFA_GATE = Symbol('PRIVILEGED_MFA_GATE');

/** Default for CI / soft — never blocks. */
@Injectable()
export class NoopPrivilegedMfaGate implements PrivilegedMfaGate {
  assertAccess(
    _userId: string,
    _tenantId: string,
    _routePermissions: ReadonlyArray<string>,
  ): Promise<void> {
    return Promise.resolve();
  }
}

/** Shared helper for tests / hard gate — throw MFA_REQUIRED. */
export function throwMfaRequired(message: string): never {
  throw new AppError('MFA_REQUIRED', message);
}
