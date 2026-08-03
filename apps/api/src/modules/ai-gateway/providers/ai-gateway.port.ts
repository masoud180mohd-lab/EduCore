/**
 * AI Gateway internal port (ACF-AI-001 / ADR-003).
 */

export type AiInvokeCommand = {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly featureCode: string;
  readonly promptCode: string;
  readonly locale: string;
  readonly variables: Readonly<Record<string, string>>;
  readonly correlationId: string;
};

export type AiInvokeUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostMinor: number;
};

export type AiInvokeResult = {
  readonly requestId: string;
  readonly status: 'succeeded' | 'failed' | 'rejected' | 'disabled';
  readonly outputText: string | null;
  readonly modelCode: string | null;
  readonly usage: AiInvokeUsage | null;
  readonly rejectReason: string | null;
  readonly providerCode: string | null;
};

export interface AiGatewayPort {
  invoke(command: AiInvokeCommand): Promise<AiInvokeResult>;
}

export const AI_GATEWAY_PORT = Symbol('AI_GATEWAY_PORT');

export type AiProviderGenerateInput = {
  readonly renderedPrompt: string;
  readonly featureCode: string;
  readonly correlationId: string;
};

export type AiProviderGenerateResult = {
  readonly providerCode: string;
  readonly modelCode: string;
  readonly outputText: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostMinor: number;
};

export interface AiProviderPort {
  readonly providerCode: string;
  generate(input: AiProviderGenerateInput): Promise<AiProviderGenerateResult>;
}

export const AI_PROVIDER_PORT = Symbol('AI_PROVIDER_PORT');
