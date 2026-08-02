import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type PackageManifest = {
  private?: unknown;
  engines?: unknown;
  scripts?: unknown;
  workspaces?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
};

type TypeScriptConfiguration = {
  compilerOptions?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function projectRootUrl(): URL {
  return new URL('../../', import.meta.url);
}

function readTextFile(relativePath: string): string {
  const root = fileURLToPath(projectRootUrl());
  const filePath = new URL(relativePath, `file://${root.replaceAll('\\', '/')}`);

  return readFileSync(filePath, 'utf8');
}

function readJsonFile<T>(relativePath: string): T {
  return JSON.parse(readTextFile(relativePath)) as T;
}

function pathExists(relativePath: string): boolean {
  const root = fileURLToPath(projectRootUrl());
  const filePath = fileURLToPath(new URL(relativePath, `file://${root.replaceAll('\\', '/')}`));

  return existsSync(filePath);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value;
}

describe('workspace standards', () => {
  it('wires module boundary checks into the quality gate for PLAT-005', () => {
    const manifest = readJsonFile<PackageManifest>('package.json');
    const scripts = requireRecord(manifest.scripts, 'package.json scripts');
    const devDependencies = requireRecord(manifest.devDependencies, 'package.json devDependencies');

    expect(typeof scripts['boundaries:check']).toBe('string');
    expect(String(scripts['check'])).toContain('boundaries:check');
    expect(typeof devDependencies['dependency-cruiser']).toBe('string');
    expect(pathExists('.dependency-cruiser.cjs')).toBe(true);
    expect(pathExists('scripts/check-module-boundaries.mjs')).toBe(true);
  });

  it('includes the NestJS API workspace package for PLAT-003', () => {
    expect(pathExists('apps/api/package.json')).toBe(true);
    const apiManifest = readJsonFile<PackageManifest>('apps/api/package.json');

    expect(apiManifest.private).toBe(true);
    expect(isRecord(apiManifest.dependencies)).toBe(true);

    const dependencies = requireRecord(apiManifest.dependencies, 'apps/api dependencies');
    expect(typeof dependencies['@nestjs/core']).toBe('string');
    expect(typeof dependencies['@nestjs/common']).toBe('string');
  });

  it('keeps the root workspace private and exposes all required quality commands', () => {
    const manifest = readJsonFile<PackageManifest>('package.json');
    const scripts = requireRecord(manifest.scripts, 'package.json scripts');
    const requiredScripts = [
      'boundaries:check',
      'check',
      'env:check',
      'format',
      'format:check',
      'lint',
      'test',
      'typecheck',
    ] as const;

    expect(manifest.private).toBe(true);
    expect(manifest.workspaces).toEqual(['apps/*', 'packages/*']);
    expect(manifest.dependencies).toBeUndefined();
    expect(isRecord(manifest.devDependencies)).toBe(true);

    for (const scriptName of requiredScripts) {
      const command = scripts[scriptName];
      expect(typeof command).toBe('string');
      expect(String(command).length).toBeGreaterThan(0);
    }
  });

  it('declares a supported Node.js engine floor', () => {
    const manifest = readJsonFile<PackageManifest>('package.json');
    const engines = requireRecord(manifest.engines, 'package.json engines');

    expect(engines['node']).toBe('>=22');
  });

  it('enforces strict TypeScript compiler settings', () => {
    const configuration = readJsonFile<TypeScriptConfiguration>('tsconfig.json');
    const compilerOptions = requireRecord(
      configuration.compilerOptions,
      'tsconfig compilerOptions',
    );

    expect(compilerOptions['exactOptionalPropertyTypes']).toBe(true);
    expect(compilerOptions['noFallthroughCasesInSwitch']).toBe(true);
    expect(compilerOptions['noImplicitOverride']).toBe(true);
    expect(compilerOptions['noImplicitReturns']).toBe(true);
    expect(compilerOptions['noPropertyAccessFromIndexSignature']).toBe(true);
    expect(compilerOptions['noUncheckedIndexedAccess']).toBe(true);
    expect(compilerOptions['noUnusedLocals']).toBe(true);
    expect(compilerOptions['noUnusedParameters']).toBe(true);
    expect(compilerOptions['strict']).toBe(true);
  });

  it('pins tooling versions through a lockfile and exact-save npm policy', () => {
    expect(pathExists('package-lock.json')).toBe(true);
    expect(pathExists('.npmrc')).toBe(true);

    const npmrc = readTextFile('.npmrc');
    expect(npmrc).toContain('save-exact=true');
    expect(npmrc).toContain('package-lock=true');
  });

  it('provides the local environment example without secrets', () => {
    expect(pathExists('.env.example')).toBe(true);

    const example = readTextFile('.env.example');
    expect(example).toContain('NODE_ENV=development');
    // Allow commented placeholder names; forbid credential-like values on active lines.
    const activeLines = example.split('\n').filter((line) => {
      const trimmed = line.trim();
      return trimmed !== '' && !trimmed.startsWith('#');
    });
    for (const line of activeLines) {
      expect(line.toLowerCase()).not.toMatch(/password|secret|api[_-]?key|token|private[_-]?key/);
    }
  });

  it('ignores local secrets and common credential material', () => {
    const gitignore = readTextFile('.gitignore');

    expect(gitignore).toContain('.env');
    expect(gitignore).toContain('!.env.example');
    expect(gitignore).toContain('*.pem');
    expect(gitignore).toContain('*.key');
    expect(gitignore).toContain('node_modules/');
  });
});
