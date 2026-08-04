/**
 * Thrown when AI_PROVIDER requests a real vendor without secrets (AI-006).
 * Gateway maps to failed / provider_not_configured — never silent Fake.
 */
export class AiProviderNotConfiguredError extends Error {
  readonly providerCode: string;

  constructor(providerCode: string) {
    super(`AI provider '${providerCode}' is not configured (missing secrets).`);
    this.name = 'AiProviderNotConfiguredError';
    this.providerCode = providerCode;
  }
}

/**
 * Placeholder bound when AI_PROVIDER=openai but OPENAI_API_KEY is missing.
 */
export class NotConfiguredAiProvider {
  constructor(readonly providerCode: string) {}

  generate(): Promise<never> {
    return Promise.reject(new AiProviderNotConfiguredError(this.providerCode));
  }
}
