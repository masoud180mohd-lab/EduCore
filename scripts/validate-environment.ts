const nodeEnvironments = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof nodeEnvironments)[number];

export function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  if (value === undefined || value === '') {
    return 'development';
  }

  if ((nodeEnvironments as readonly string[]).includes(value)) {
    return value as NodeEnvironment;
  }

  // Never echo the invalid value — it may contain sensitive material pasted by mistake.
  throw new Error('NODE_ENV must be one of: development, test, production.');
}

export function validateEnvironment(environment: NodeJS.ProcessEnv = process.env): NodeEnvironment {
  return parseNodeEnvironment(environment['NODE_ENV']);
}

function isExecutedDirectly(): boolean {
  const executedPath = process.argv[1];

  return executedPath !== undefined && import.meta.filename === executedPath;
}

if (isExecutedDirectly()) {
  const nodeEnvironment = validateEnvironment();
  process.stdout.write(`Environment validation passed for ${nodeEnvironment}.\n`);
}
