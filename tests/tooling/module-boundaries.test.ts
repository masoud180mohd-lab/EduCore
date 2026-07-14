import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const depcruiseCli = path.join(
  projectRoot,
  'node_modules',
  'dependency-cruiser',
  'bin',
  'dependency-cruise.mjs',
);

function readText(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readText(relativePath)) as Record<string, unknown>;
}

function runBoundariesCheck(): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(
    process.execPath,
    [path.join(projectRoot, 'scripts/check-module-boundaries.mjs')],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: process.env,
    },
  );

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function runDepcruiseOn(targetRelativePath: string): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(
    process.execPath,
    [
      depcruiseCli,
      '--config',
      path.join(projectRoot, '.dependency-cruiser.cjs'),
      '--validate',
      '--output-type',
      'err',
      path.join(projectRoot, targetRelativePath),
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: process.env,
    },
  );

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe('PLAT-005 module boundary enforcement', () => {
  // dependency-cruiser process spawns are slower on cold Windows runs.
  const boundaryTimeoutMs = 30_000;

  it('exposes boundaries:check in the quality gate', () => {
    const manifest = readJson('package.json');
    const scripts = manifest['scripts'];
    expect(typeof scripts).toBe('object');
    expect(scripts).not.toBeNull();

    const scriptMap = scripts as Record<string, unknown>;
    expect(String(scriptMap['boundaries:check'])).toContain('check-module-boundaries');
    expect(String(scriptMap['check'])).toContain('boundaries:check');

    const devDependencies = manifest['devDependencies'];
    expect(typeof devDependencies).toBe('object');
    expect(devDependencies).not.toBeNull();
    expect(typeof (devDependencies as Record<string, unknown>)['dependency-cruiser']).toBe(
      'string',
    );
  });

  it('ships a dependency-cruiser rule set for cross-module isolation', () => {
    expect(existsSync(path.join(projectRoot, '.dependency-cruiser.cjs'))).toBe(true);
    const config = readText('.dependency-cruiser.cjs');
    expect(config).toContain('no-cross-module-internal-imports');
    expect(config).toContain('composition-uses-public-module-api');
    expect(config).toContain('no-common-depends-on-modules');
    expect(config).toContain('no-circular');
  });

  it('requires public API barrels for all fourteen bounded contexts', () => {
    const modules = [
      'identity-and-access',
      'tenant-and-billing',
      'student-registry',
      'academic-structure',
      'attendance',
      'assessment',
      'finance-ledger',
      'payments',
      'communication',
      'documents-and-files',
      'ai-insights',
      'integrations',
      'analytics',
      'platform-operations',
    ];

    for (const moduleName of modules) {
      const barrel = path.join(projectRoot, 'apps/api/src/modules', moduleName, 'index.ts');
      expect(existsSync(barrel)).toBe(true);
      const contents = readFileSync(barrel, 'utf8');
      expect(contents).toContain('Public API');
      expect(contents).toContain('Module');
    }
  });

  it(
    'passes boundary validation for the current API skeleton',
    () => {
      const result = runBoundariesCheck();
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(`${result.stdout}${result.stderr}`).toMatch(/Module boundary check passed/i);
    },
    boundaryTimeoutMs,
  );

  it(
    'fails when a module deeply imports another module internal',
    () => {
      const probeDir = path.join(
        projectRoot,
        'apps/api/src/modules/payments/__plat005_boundary_probe__',
      );
      const probeFile = path.join(probeDir, 'forbidden-import.ts');

      mkdirSync(probeDir, { recursive: true });
      writeFileSync(
        probeFile,
        [
          "import { IdentityAndAccessDomainService } from '../../identity-and-access/domain/identity-and-access.domain-service.js';",
          'export const forbiddenProbe = IdentityAndAccessDomainService;',
          '',
        ].join('\n'),
        'utf8',
      );

      try {
        const result = runDepcruiseOn('apps/api/src');
        expect(result.status, `${result.stdout}\n${result.stderr}`).not.toBe(0);
        const output = `${result.stdout}\n${result.stderr}`;
        expect(output).toMatch(/no-cross-module-internal-imports|error/i);
      } finally {
        rmSync(probeDir, { recursive: true, force: true });
      }
    },
    boundaryTimeoutMs,
  );

  it(
    'allows a module to import another module public barrel',
    () => {
      const probeDir = path.join(
        projectRoot,
        'apps/api/src/modules/payments/__plat005_boundary_probe__',
      );
      const probeFile = path.join(probeDir, 'allowed-import.ts');

      mkdirSync(probeDir, { recursive: true });
      writeFileSync(
        probeFile,
        [
          "import { IdentityAndAccessEventNames } from '../../identity-and-access/index.js';",
          'export const allowedProbe = IdentityAndAccessEventNames;',
          '',
        ].join('\n'),
        'utf8',
      );

      try {
        const result = runDepcruiseOn('apps/api/src');
        expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      } finally {
        rmSync(probeDir, { recursive: true, force: true });
      }
    },
    boundaryTimeoutMs,
  );
});
