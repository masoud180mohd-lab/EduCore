export type AppRuntimeEnvironment = 'development' | 'test' | 'production';

export type AppConfig = {
  readonly environment: AppRuntimeEnvironment;
  readonly port: number;
  readonly serviceName: string;
};

const runtimeEnvironments: readonly AppRuntimeEnvironment[] = ['development', 'test', 'production'];

function parseEnvironment(value: string | undefined): AppRuntimeEnvironment {
  if (value === undefined || value === '') {
    return 'development';
  }

  if ((runtimeEnvironments as readonly string[]).includes(value)) {
    return value as AppRuntimeEnvironment;
  }

  throw new Error('NODE_ENV must be one of: development, test, production.');
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') {
    return 3000;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

/**
 * Loads non-secret runtime configuration only.
 * Database URLs, provider keys, and other secrets are out of scope until later approved work.
 */
export function loadAppConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    environment: parseEnvironment(environment['NODE_ENV']),
    port: parsePort(environment['PORT']),
    serviceName: environment['SERVICE_NAME']?.trim() || 'educore-api',
  };
}
