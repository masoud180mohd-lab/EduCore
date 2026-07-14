export type LogFields = Readonly<Record<string, unknown>>;

/**
 * Structured logging surface. Implementations must redact secrets and child-sensitive data.
 * Full observability stack selection remains deferred.
 */
export interface AppLogger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|authorization|cookie|otp|api[_-]?key|private[_-]?key)/i;

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => redactValue(String(index), entry));
  }

  if (typeof value === 'object' && value !== null) {
    return redactFields(value as Record<string, unknown>);
  }

  return value;
}

export function redactFields(fields: LogFields): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    redacted[key] = redactValue(key, value);
  }

  return redacted;
}

export class ConsoleAppLogger implements AppLogger {
  info(message: string, fields: LogFields = {}): void {
    process.stdout.write(
      `${JSON.stringify({ level: 'info', message, ...redactFields(fields) })}\n`,
    );
  }

  warn(message: string, fields: LogFields = {}): void {
    process.stdout.write(
      `${JSON.stringify({ level: 'warn', message, ...redactFields(fields) })}\n`,
    );
  }

  error(message: string, fields: LogFields = {}): void {
    process.stderr.write(
      `${JSON.stringify({ level: 'error', message, ...redactFields(fields) })}\n`,
    );
  }
}
