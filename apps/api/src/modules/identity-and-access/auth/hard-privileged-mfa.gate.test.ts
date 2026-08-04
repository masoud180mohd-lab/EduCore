/**
 * Hard privileged MFA continuous gate.
 */
import { describe, expect, it, vi } from 'vitest';

import { HardPrivilegedMfaGate } from './hard-privileged-mfa.gate.js';
import type { MfaRepository } from '../repositories/mfa.repository.js';

describe('HardPrivilegedMfaGate', () => {
  it('no-ops when MFA_ENFORCE is soft', async () => {
    const prev = process.env['MFA_ENFORCE'];
    process.env['MFA_ENFORCE'] = 'soft';
    const mfa = {
      isAvailable: () => true,
      hasActiveTotp: vi.fn(),
    } as unknown as MfaRepository;
    const gate = new HardPrivilegedMfaGate(mfa);
    await expect(gate.assertAccess('u1', 't1', ['finance.manage'])).resolves.toBeUndefined();
    expect(mfa.hasActiveTotp).not.toHaveBeenCalled();
    if (prev === undefined) delete process.env['MFA_ENFORCE'];
    else process.env['MFA_ENFORCE'] = prev;
  });

  it('allows non-privileged routes under hard', async () => {
    const prev = process.env['MFA_ENFORCE'];
    process.env['MFA_ENFORCE'] = 'hard';
    const mfa = {
      isAvailable: () => true,
      hasActiveTotp: vi.fn(),
    } as unknown as MfaRepository;
    const gate = new HardPrivilegedMfaGate(mfa);
    await expect(gate.assertAccess('u1', 't1', ['student.read'])).resolves.toBeUndefined();
    expect(mfa.hasActiveTotp).not.toHaveBeenCalled();
    if (prev === undefined) delete process.env['MFA_ENFORCE'];
    else process.env['MFA_ENFORCE'] = prev;
  });

  it('denies privileged routes without TOTP under hard', async () => {
    const prev = process.env['MFA_ENFORCE'];
    process.env['MFA_ENFORCE'] = 'hard';
    const mfa = {
      isAvailable: () => true,
      hasActiveTotp: vi.fn().mockResolvedValue(false),
    } as unknown as MfaRepository;
    const gate = new HardPrivilegedMfaGate(mfa);
    await expect(gate.assertAccess('u1', 't1', ['finance.manage'])).rejects.toMatchObject({
      code: 'MFA_REQUIRED',
    });
    if (prev === undefined) delete process.env['MFA_ENFORCE'];
    else process.env['MFA_ENFORCE'] = prev;
  });

  it('fails closed when MFA store unavailable under hard', async () => {
    const prev = process.env['MFA_ENFORCE'];
    process.env['MFA_ENFORCE'] = 'hard';
    const mfa = {
      isAvailable: () => false,
      hasActiveTotp: vi.fn(),
    } as unknown as MfaRepository;
    const gate = new HardPrivilegedMfaGate(mfa);
    await expect(gate.assertAccess('u1', 't1', ['tenant.manage'])).rejects.toMatchObject({
      code: 'MFA_REQUIRED',
    });
    if (prev === undefined) delete process.env['MFA_ENFORCE'];
    else process.env['MFA_ENFORCE'] = prev;
  });
});
