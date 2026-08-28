/**
 * Browser CORS allowlist. Localhost always; extra origins from CORS_ORIGINS
 * (comma-separated https:// hosts). No wildcards.
 */
const LOCAL_ORIGINS: readonly string[] = [
  'http://127.0.0.1:3001',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
];

export function resolveCorsOrigins(
  environment: NodeJS.ProcessEnv = process.env,
): readonly string[] {
  const extra = (environment['CORS_ORIGINS'] ?? '')
    .split(',')
    .map((value) => parseHttpOrigin(value))
    .filter((value): value is string => value !== null);
  return [...new Set([...LOCAL_ORIGINS, ...extra])];
}

function parseHttpOrigin(raw: string): string | null {
  const value = raw.trim();
  if (value === '' || value.includes('*')) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.pathname !== '/' && url.pathname !== '') return null;
    if (url.search !== '' || url.hash !== '') return null;
    return url.origin;
  } catch {
    return null;
  }
}
