import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function readText(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readText(relativePath)) as Record<string, unknown>;
}

describe('DEV-001 local Docker development platform', () => {
  it('provides a compose file with postgres and redis only for local use', () => {
    expect(existsSync(path.join(projectRoot, 'docker-compose.yml'))).toBe(true);

    const compose = readText('docker-compose.yml');
    expect(compose).toMatch(/services:/);
    expect(compose).toMatch(/postgres:/);
    expect(compose).toMatch(/redis:/);
    expect(compose).toMatch(/healthcheck:/);
    expect(compose).toMatch(/pg_isready/);
    expect(compose).toMatch(/redis-cli/);
    expect(compose).toMatch(/educore_postgres_data/);
    expect(compose).toMatch(/educore_redis_data/);

    // Keep scope local: no cloud provider topology or app business schema.
    expect(compose).not.toMatch(/kubernetes|eks|gke|aks|terraform/i);
    expect(compose).not.toMatch(/CREATE TABLE|prisma|typeorm|flyway|liquibase/i);
    expect(compose).toMatch(/POSTGRES_USER/);
    expect(compose).toMatch(/REDIS_PASSWORD/);
  });

  it('documents local-only docker environment defaults without real secrets', () => {
    expect(existsSync(path.join(projectRoot, '.env.docker.example'))).toBe(true);

    const example = readText('.env.docker.example');
    expect(example).toContain('POSTGRES_USER=');
    expect(example).toContain('POSTGRES_PASSWORD=');
    expect(example).toContain('POSTGRES_DB=');
    expect(example).toContain('REDIS_PASSWORD=');
    expect(example.toLowerCase()).toMatch(/local/);
    expect(example.toLowerCase()).not.toMatch(/sk_live|prod_password|aws_secret/);
  });

  it('exposes docker npm scripts for up/down/ps/logs', () => {
    const manifest = readJson('package.json');
    const scripts = manifest['scripts'] as Record<string, unknown>;

    expect(String(scripts['docker:up'])).toMatch(/docker compose/i);
    expect(String(scripts['docker:down'])).toMatch(/docker compose/i);
    expect(String(scripts['docker:ps'])).toMatch(/docker compose/i);
    expect(String(scripts['docker:logs'])).toMatch(/docker compose/i);
  });

  it('keeps application env baseline free of docker runtime secrets', () => {
    const appEnvExample = readText('.env.example');
    expect(appEnvExample).toContain('NODE_ENV=development');
    expect(appEnvExample).not.toContain('POSTGRES_PASSWORD=');
    expect(appEnvExample).not.toContain('REDIS_PASSWORD=');
  });
});
