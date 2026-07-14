/**
 * Audit event publishing surface (IMP-001-T19).
 * Other modules import only via platform-operations public barrel.
 * Persistence (audit_events + RLS) is deferred; foundation supports outbox-style append.
 */

export type AuditOutcome = 'success' | 'failure' | 'denied';

export type AuditEventInput = {
  readonly action: string;
  readonly outcome: AuditOutcome;
  readonly correlationId: string;
  readonly actorUserId?: string;
  readonly tenantId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly occurredAt?: string;
};

export interface AuditPublisher {
  publish(event: AuditEventInput): Promise<void>;
}

export const AUDIT_PUBLISHER = Symbol('AUDIT_PUBLISHER');

const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|authorization|cookie|otp|api[_-]?key|private[_-]?key|refresh)/i;

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => redactValue(String(index), entry));
  }
  if (typeof value === 'object' && value !== null) {
    return redactAuditMetadata(value as Record<string, unknown>);
  }
  return value;
}

/** Redact secrets from audit metadata before append. */
export function redactAuditMetadata(
  metadata: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

export function sanitizeAuditEvent(event: AuditEventInput): AuditEventInput {
  return {
    ...event,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    ...(event.metadata === undefined ? {} : { metadata: redactAuditMetadata(event.metadata) }),
  };
}

/**
 * No-op publisher until outbox / audit_events table wiring lands.
 */
export class NoopAuditPublisher implements AuditPublisher {
  publish(_event: AuditEventInput): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * In-memory append-only publisher for tests and local observation.
 */
export class InMemoryAuditPublisher implements AuditPublisher {
  readonly events: AuditEventInput[] = [];

  publish(event: AuditEventInput): Promise<void> {
    this.events.push(sanitizeAuditEvent(event));
    return Promise.resolve();
  }

  clear(): void {
    this.events.length = 0;
  }
}
