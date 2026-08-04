/**
 * AI gateway persistence (AI-002 / DBF-AI-001).
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool, QueryResultRow } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type AiPromptTemplateRow = {
  readonly id: string;
  readonly code: string;
  readonly version: number;
  readonly locale: string;
  readonly body: string;
  readonly status: string;
  readonly allowlistPlaceholders: ReadonlyArray<string>;
  readonly createdAt: string;
};

export type AiInvokeRequestRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly featureCode: string;
  readonly promptCode: string;
  readonly promptVersion: number;
  readonly locale: string;
  readonly correlationId: string;
  readonly status: string;
  readonly rejectReason: string | null;
  readonly modelCode: string | null;
  readonly providerCode: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly estimatedCostMinor: number | null;
  readonly outputPreview: string | null;
  readonly createdAt: string;
};

export type AiUsageDailyRow = {
  readonly usageDate: string;
  readonly featureCode: string;
  readonly requestCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostMinor: number;
};

export type CompleteAiInvokeInput = {
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly requestId: string;
  readonly featureCode: string;
  readonly promptCode: string;
  readonly promptVersion: number;
  readonly locale: string;
  readonly correlationId: string;
  readonly status: 'succeeded' | 'failed' | 'rejected' | 'disabled';
  readonly rejectReason: string | null;
  readonly modelCode: string | null;
  readonly providerCode: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly estimatedCostMinor: number | null;
  readonly outputPreview: string | null;
  readonly variablesRedacted: Readonly<Record<string, string>> | null;
  readonly countUsage: boolean;
};

@Injectable()
export class AiGatewayRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  async listPrompts(
    actorUserId: string,
    tenantId: string,
    options: {
      readonly code?: string;
      readonly locale?: string;
      readonly includeRetired?: boolean;
    } = {},
  ): Promise<ReadonlyArray<AiPromptTemplateRow>> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) return [];
    const code = options.code?.trim();
    const locale = options.locale?.trim();
    const includeRetired = options.includeRetired === true;
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId];
          const filters: string[] = ['(tenant_id IS NULL OR tenant_id = $1::uuid)'];
          if (!includeRetired) {
            filters.push(`status = 'active'`);
          }
          if (code !== undefined && code !== '') {
            params.push(code);
            filters.push(`code = $${params.length}`);
          }
          if (locale !== undefined && locale !== '') {
            params.push(locale);
            filters.push(`locale = $${params.length}`);
          }

          const where = filters.join(' AND ');
          const sql = includeRetired
            ? `SELECT id, code, version, locale, body, status, allowlist_placeholders, created_at
               FROM ai_prompt_templates
               WHERE ${where}
               ORDER BY code ASC, locale ASC, version DESC`
            : `SELECT DISTINCT ON (code, locale)
                    id, code, version, locale, body, status, allowlist_placeholders, created_at
               FROM ai_prompt_templates
               WHERE ${where}
               ORDER BY code ASC, locale ASC,
                        CASE WHEN tenant_id IS NOT NULL THEN 0 ELSE 1 END ASC,
                        version DESC`;

          const result = await client.query<{
            id: string;
            code: string;
            version: number;
            locale: string;
            body: string;
            status: string;
            allowlist_placeholders: unknown;
            created_at: Date;
          }>(sql, params);
          return result.rows.map(mapPromptRow);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AiGatewayRepository', error, {
        operation: 'listPrompts',
      });
      return [];
    }
  }

  /** @deprecated Prefer listPrompts — kept for callers expecting active-only. */
  async listActivePrompts(
    actorUserId: string,
    tenantId: string,
  ): Promise<ReadonlyArray<AiPromptTemplateRow>> {
    return this.listPrompts(actorUserId, tenantId, { includeRetired: false });
  }

  async getActivePrompt(
    actorUserId: string,
    tenantId: string,
    code: string,
    locale: string,
  ): Promise<AiPromptTemplateRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) return null;
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<{
            id: string;
            code: string;
            version: number;
            locale: string;
            body: string;
            status: string;
            allowlist_placeholders: unknown;
            created_at: Date;
          }>(
            `SELECT id, code, version, locale, body, status, allowlist_placeholders, created_at
             FROM ai_prompt_templates
             WHERE status = 'active'
               AND code = $2
               AND locale = $3
               AND (tenant_id IS NULL OR tenant_id = $1::uuid)
             ORDER BY
               CASE WHEN tenant_id IS NOT NULL THEN 0 ELSE 1 END ASC,
               version DESC
             LIMIT 1`,
            [tenantId, code, locale],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapPromptRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AiGatewayRepository', error, {
        operation: 'getActivePrompt',
      });
      return null;
    }
  }

  async getInvokeRequest(
    actorUserId: string,
    tenantId: string,
    requestId: string,
  ): Promise<AiInvokeRequestRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(requestId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<{
            id: string;
            tenant_id: string;
            feature_code: string;
            prompt_code: string;
            prompt_version: number;
            locale: string;
            correlation_id: string;
            status: string;
            reject_reason: string | null;
            model_code: string | null;
            provider_code: string | null;
            input_tokens: number | null;
            output_tokens: number | null;
            estimated_cost_minor: number | null;
            output_preview: string | null;
            created_at: Date;
          }>(
            `SELECT id, tenant_id, feature_code, prompt_code, prompt_version, locale,
                    correlation_id, status, reject_reason, model_code, provider_code,
                    input_tokens, output_tokens, estimated_cost_minor, output_preview, created_at
             FROM ai_invoke_requests
             WHERE id = $1::uuid AND tenant_id = $2::uuid`,
            [requestId, tenantId],
          );
          const row = result.rows[0];
          if (row === undefined) return null;
          return {
            id: row.id,
            tenantId: row.tenant_id,
            featureCode: row.feature_code,
            promptCode: row.prompt_code,
            promptVersion: row.prompt_version,
            locale: row.locale,
            correlationId: row.correlation_id,
            status: row.status,
            rejectReason: row.reject_reason,
            modelCode: row.model_code,
            providerCode: row.provider_code,
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            estimatedCostMinor: row.estimated_cost_minor,
            outputPreview: row.output_preview,
            createdAt: row.created_at.toISOString(),
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AiGatewayRepository', error, {
        operation: 'getInvokeRequest',
      });
      return null;
    }
  }

  async listUsageDaily(
    actorUserId: string,
    tenantId: string,
    usageDate: string,
    featureCode: string | undefined,
  ): Promise<ReadonlyArray<AiUsageDailyRow>> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) return [];
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<{
            usage_date: Date | string;
            feature_code: string;
            request_count: number;
            input_tokens: number;
            output_tokens: number;
            estimated_cost_minor: number;
          }>(
            featureCode === undefined
              ? `SELECT usage_date, feature_code, request_count, input_tokens, output_tokens, estimated_cost_minor
                 FROM ai_usage_daily
                 WHERE tenant_id = $1::uuid AND usage_date = $2::date
                 ORDER BY feature_code ASC`
              : `SELECT usage_date, feature_code, request_count, input_tokens, output_tokens, estimated_cost_minor
                 FROM ai_usage_daily
                 WHERE tenant_id = $1::uuid AND usage_date = $2::date AND feature_code = $3
                 ORDER BY feature_code ASC`,
            featureCode === undefined ? [tenantId, usageDate] : [tenantId, usageDate, featureCode],
          );
          return result.rows.map((row) => ({
            usageDate: formatUsageDate(row.usage_date),
            featureCode: row.feature_code,
            requestCount: Number(row.request_count),
            inputTokens: Number(row.input_tokens),
            outputTokens: Number(row.output_tokens),
            estimatedCostMinor: Number(row.estimated_cost_minor),
          }));
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AiGatewayRepository', error, {
        operation: 'listUsageDaily',
      });
      return [];
    }
  }

  /**
   * Sum of request_count for tenant + UTC date (all featureCodes).
   * Fail closed: throws when pool/membership/DB cannot load the meter (AI-004).
   */
  async sumRequestCountForDate(
    actorUserId: string,
    tenantId: string,
    usageDate: string,
  ): Promise<number> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      throw new Error('AI usage meter unavailable');
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<{ total: string | number }>(
            `SELECT COALESCE(SUM(request_count), 0) AS total
             FROM ai_usage_daily
             WHERE tenant_id = $1::uuid AND usage_date = $2::date`,
            [tenantId, usageDate],
          );
          return Number(result.rows[0]?.total ?? 0);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AiGatewayRepository', error, {
        operation: 'sumRequestCountForDate',
      });
      throw error instanceof Error ? error : new Error('AI usage meter unavailable');
    }
  }

  async completeInvoke(input: CompleteAiInvokeInput): Promise<void> {
    if (this.pool === null) throw new Error('AI gateway store unavailable');
    await withTenantTransaction(
      this.pool,
      { userId: input.actorUserId, tenantId: input.tenantId },
      async (client) => {
        await client.query(
          `SELECT app.ai_complete_invoke(
             $1::uuid, $2::uuid, $3::uuid, $4, $5, $6::int, $7, $8, $9, $10,
             $11, $12, $13::int, $14::int, $15::int, $16, $17::jsonb, $18::boolean
           )`,
          [
            input.actorUserId,
            input.tenantId,
            input.requestId,
            input.featureCode,
            input.promptCode,
            input.promptVersion,
            input.locale,
            input.correlationId,
            input.status,
            input.rejectReason,
            input.modelCode,
            input.providerCode,
            input.inputTokens,
            input.outputTokens,
            input.estimatedCostMinor,
            input.outputPreview,
            input.variablesRedacted === null ? null : JSON.stringify(input.variablesRedacted),
            input.countUsage,
          ],
        );
      },
    );
  }
}

function mapPromptRow(row: {
  id: string;
  code: string;
  version: number;
  locale: string;
  body: string;
  status: string;
  allowlist_placeholders: unknown;
  created_at: Date;
}): AiPromptTemplateRow {
  return {
    id: row.id,
    code: row.code,
    version: Number(row.version),
    locale: row.locale,
    body: row.body,
    status: row.status,
    allowlistPlaceholders: parseAllowlist(row.allowlist_placeholders),
    createdAt: row.created_at.toISOString(),
  };
}

function parseAllowlist(raw: unknown): ReadonlyArray<string> {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      return [];
    }
  }
  return [];
}

function formatUsageDate(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** Narrow QueryResultRow usage for future typed helpers. */
export type AiGatewayQueryRow = QueryResultRow;
