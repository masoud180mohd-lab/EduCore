import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const depcruiseCli = path.join(
  projectRoot,
  'node_modules',
  'dependency-cruiser',
  'bin',
  'dependency-cruise.mjs',
);
const configPath = path.join(projectRoot, '.dependency-cruiser.cjs');
const target = path.join(projectRoot, 'apps', 'api', 'src');

if (!existsSync(depcruiseCli)) {
  process.stderr.write(
    'dependency-cruiser is not installed. Run npm install from the repository root.\n',
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [depcruiseCli, '--config', configPath, '--validate', '--output-type', 'err', target],
  {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.error) {
  process.stderr.write(`Boundary check failed to start: ${result.error.message}\n`);
  process.exit(1);
}

if (result.status !== 0) {
  process.stderr.write(
    'Module boundary check failed. Fix forbidden cross-module imports (use public barrels only).\n',
  );
  process.exit(result.status ?? 1);
}

process.stdout.write('Module boundary check passed.\n');
