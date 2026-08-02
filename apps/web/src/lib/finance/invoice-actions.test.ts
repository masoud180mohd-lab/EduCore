import { describe, expect, it } from 'vitest';

import {
  billPayDisplay,
  canIssueInvoice,
  canRecordPayment,
  canReconcilePayment,
  canReversePayment,
  canSyncProviderPayment,
  canVoidInvoice,
  paymentMethodLabel,
  paymentStatusLabel,
  reconcileOutcomeLabel,
  syncProviderDetailLabel,
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

  it('allows sync-provider only for pending mobile_money', () => {
    expect(canSyncProviderPayment('pending', 'mobile_money')).toBe(true);
    expect(canSyncProviderPayment('succeeded', 'mobile_money')).toBe(false);
    expect(canSyncProviderPayment('pending', 'cash')).toBe(false);
    expect(canSyncProviderPayment('failed', 'mobile_money')).toBe(false);
  });

  it('labels payment status including pending and failed', () => {
    expect(paymentStatusLabel('pending')).toBe('Pending');
    expect(paymentStatusLabel('failed')).toBe('Failed');
    expect(paymentStatusLabel('succeeded')).toBe('Succeeded');
    expect(paymentStatusLabel('reversed')).toBe('Reversed');
  });

  it('labels payment methods for bursar list', () => {
    expect(paymentMethodLabel('mobile_money')).toBe('Mobile money');
    expect(paymentMethodLabel('cash')).toBe('Cash');
  });

  it('shows BillPay from allowlist fields only', () => {
    expect(billPayDisplay({ method: 'mobile_money', providerRef: '55042914871931' })).toBe(
      '55042914871931',
    );
    expect(
      billPayDisplay({
        method: 'mobile_money',
        billPayNumber: '111',
        providerRef: '222',
      }),
    ).toBe('111');
    expect(billPayDisplay({ method: 'cash', providerRef: 'x' })).toBeNull();
    expect(billPayDisplay({ method: 'mobile_money', providerRef: null })).toBeNull();
  });

  it('labels sync-provider details', () => {
    expect(syncProviderDetailLabel('still_pending')).toBe('Still pending at provider');
    expect(syncProviderDetailLabel('completed')).toBe('Completed');
  });
});
