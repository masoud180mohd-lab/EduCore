import { describe, expect, it } from 'vitest';

import {
  canIssueInvoice,
  canRecordPayment,
  canReconcilePayment,
  canReversePayment,
  canVoidInvoice,
  reconcileOutcomeLabel,
} from './invoice-actions.js';

describe('invoice action enablement', () => {
  it('allows issue only for draft', () => {
    expect(canIssueInvoice('draft')).toBe(true);
    expect(canIssueInvoice('issued')).toBe(false);
    expect(canIssueInvoice('paid')).toBe(false);
  });

  it('allows void only for issued full balance', () => {
    expect(canVoidInvoice('issued', 1000, 1000)).toBe(true);
    expect(canVoidInvoice('issued', 500, 1000)).toBe(false);
    expect(canVoidInvoice('partially_paid', 500, 1000)).toBe(false);
    expect(canVoidInvoice('paid', 0, 1000)).toBe(false);
    expect(canVoidInvoice('draft', 1000, 1000)).toBe(false);
  });

  it('allows pay only issued/partial with balance > 0', () => {
    expect(canRecordPayment('issued', 1000)).toBe(true);
    expect(canRecordPayment('partially_paid', 100)).toBe(true);
    expect(canRecordPayment('issued', 0)).toBe(false);
    expect(canRecordPayment('draft', 1000)).toBe(false);
    expect(canRecordPayment('paid', 0)).toBe(false);
  });

  it('allows reverse only for succeeded payments', () => {
    expect(canReversePayment('succeeded')).toBe(true);
    expect(canReversePayment('reversed')).toBe(false);
    expect(canReversePayment('pending')).toBe(false);
  });

  it('allows reconcile for recorded payments (not empty/created)', () => {
    expect(canReconcilePayment('succeeded')).toBe(true);
    expect(canReconcilePayment('pending')).toBe(true);
    expect(canReconcilePayment('failed')).toBe(true);
    expect(canReconcilePayment('created')).toBe(false);
    expect(canReconcilePayment('')).toBe(false);
  });

  it('labels reconcile outcomes for operators', () => {
    expect(reconcileOutcomeLabel('matched')).toBe('Matched');
    expect(reconcileOutcomeLabel('missing_event')).toBe('No gateway event');
    expect(reconcileOutcomeLabel('amount_mismatch')).toBe('Amount mismatch');
  });
});
