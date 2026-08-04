/**
 * AI-004 usage metering helpers.
 */
import { describe, expect, it } from 'vitest';

import { AppError } from '../../../common/errors/app-error.js';
import { parseAiUsageDate, sumAiUsageRows } from './ai-usage.js';

describe('sumAiUsageRows', () => {
  it('sums request and token totals across feature rows', () => {
    expect(
      sumAiUsageRows([
        {
          requestCount: 2,
          inputTokens: 10,
          outputTokens: 8,
          estimatedCostMinor: 1,
        },
        {
          requestCount: 3,
          inputTokens: 5,
          outputTokens: 7,
          estimatedCostMinor: 2,
        },
      ]),
    ).toEqual({
      requestCountTotal: 5,
      inputTokensTotal: 15,
      outputTokensTotal: 15,
      estimatedCostMinorTotal: 3,
    });
  });
});

describe('parseAiUsageDate', () => {
  it('defaults to UTC today', () => {
    expect(parseAiUsageDate(undefined, new Date('2026-08-03T15:00:00.000Z'))).toBe('2026-08-03');
  });

  it('accepts valid YYYY-MM-DD', () => {
    expect(parseAiUsageDate('2026-08-03')).toBe('2026-08-03');
  });

  it('rejects invalid calendar days and formats', () => {
    expect(() => parseAiUsageDate('2026-02-31')).toThrow(AppError);
    expect(() => parseAiUsageDate('08-03-2026')).toThrow(AppError);
    expect(() => parseAiUsageDate(20260803)).toThrow(AppError);
  });
});
