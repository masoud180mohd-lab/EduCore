import { describe, expect, it } from 'vitest';

import {
  canIssueInvoice,
  canRecordPayment,
  canReversePayment,
  canVoidInvoice,
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
});
