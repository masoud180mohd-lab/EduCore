/**
 * AI usage metering helpers (AI-004) — date parse + totals.
 */

import { AppError } from '../../../common/errors/app-error.js';

/**
 * Metering policy (v1):
 * - Increment `ai_usage_daily` only when invoke `status=succeeded` AND `countUsage=true`
 *   (SQL also requires both; rejected / disabled / failed / cap / gate do not bump success meters).
 * - Cap = sum of `request_count` across all featureCodes for tenant + UTC date.
 * - Bypass (`AI_BYPASS_DAILY_CAP`): cap not enforced; success meters still increment.
 * - Upsert is atomic (`ON CONFLICT DO UPDATE`); concurrent success paths do not lose increments.
 * - Cap check is check-then-act before provider; modest parallel lab traffic may overshoot
 *   the cap by concurrency (documented); reads fail closed when meter cannot be loaded.
 */

export type AiUsageTotals = {
  readonly requestCountTotal: number;
  readonly inputTokensTotal: number;
  readonly outputTokensTotal: number;
  readonly estimatedCostMinorTotal: number;
};

export function sumAiUsageRows(
  rows: ReadonlyArray<{
    readonly requestCount: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostMinor: number;
  }>,
): AiUsageTotals {
  return rows.reduce<AiUsageTotals>(
    (acc, row) => ({
      requestCountTotal: acc.requestCountTotal + row.requestCount,
      inputTokensTotal: acc.inputTokensTotal + row.inputTokens,
      outputTokensTotal: acc.outputTokensTotal + row.outputTokens,
      estimatedCostMinorTotal: acc.estimatedCostMinorTotal + row.estimatedCostMinor,
    }),
    {
      requestCountTotal: 0,
      inputTokensTotal: 0,
      outputTokensTotal: 0,
      estimatedCostMinorTotal: 0,
    },
  );
}

/** UTC calendar date `YYYY-MM-DD`; default today UTC when omitted. */
export function parseAiUsageDate(raw: unknown, now: Date = new Date()): string {
  if (raw === undefined || raw === null || raw === '') {
    return now.toISOString().slice(0, 10);
  }
  if (typeof raw !== 'string') {
    throw AppError.validation('date must be YYYY-MM-DD.', { field: 'date' });
  }
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw AppError.validation('date must be YYYY-MM-DD.', { field: 'date' });
  }
  const parsed = Date.parse(`${trimmed}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    throw AppError.validation('date must be a valid calendar day.', { field: 'date' });
  }
  const roundTrip = new Date(parsed).toISOString().slice(0, 10);
  if (roundTrip !== trimmed) {
    throw AppError.validation('date must be a valid calendar day.', { field: 'date' });
  }
  return trimmed;
}
