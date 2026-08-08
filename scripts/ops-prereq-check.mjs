#!/usr/bin/env node
/**
 * OPS-001 Phase 0 — print whether deploy tooling is available on PATH.
 * Does not contact cloud APIs or print secrets.
 *
 * Required: flyctl (or fly), doppler, docker daemon
 * Optional: neonctl (Neon console alone is enough)
 */
import { spawnSync } from 'node:child_process';

function run(cmd, args) {
  return spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: true,
    windowsHide: true,
  });
}

function which(cmd) {
  const r = run(cmd, ['--version']);
  if (!r.error && r.status === 0) {
    return { ok: true, detail: (r.stdout || '').trim().split('\n')[0] ?? 'ok' };
  }
  // flyctl may only respond to `version` without dashes
  const r2 = run(cmd, ['version']);
  if (!r2.error && r2.status === 0) {
    return { ok: true, detail: (r2.stdout || '').trim().split('\n')[0] ?? 'ok' };
  }
  const err = (r.stderr || r2.stderr || r.error?.message || 'not found').trim();
  return { ok: false, detail: err.split('\n')[0] ?? err };
}

function dockerDaemon() {
  const r = run('docker', ['info', '-f', '{{.ServerVersion}}']);
  if (r.error || r.status !== 0) {
    return { ok: false, detail: 'Docker daemon not reachable — start Docker Desktop' };
  }
  const ver = (r.stdout || '').trim();
  return ver
    ? { ok: true, detail: `Server ${ver}` }
    : { ok: false, detail: 'Docker daemon not reachable — start Docker Desktop' };
}

const flyctl = which('flyctl');
const fly = which('fly');
const flyOk = flyctl.ok || fly.ok;

const required = [
  {
    name: 'flyctl',
    ok: flyOk,
    detail: flyctl.ok
      ? flyctl.detail
      : fly.ok
        ? `OK via fly alias — ${fly.detail}`
        : flyctl.detail,
  },
  { name: 'doppler', ...which('doppler') },
  { name: 'docker daemon', ...dockerDaemon() },
];

const optional = [
  {
    name: 'fly (alias, optional)',
    ok: fly.ok,
    detail: fly.ok ? fly.detail : 'optional — flyctl alone is enough',
  },
  {
    name: 'neonctl (optional)',
    ...(() => {
      const n = which('neonctl');
      return n.ok
        ? n
        : { ok: false, detail: 'optional — Neon console alone is enough' };
    })(),
  },
];

console.log('OPS-001 Phase 0 prereq check\n');

let failed = 0;
for (const c of required) {
  const mark = c.ok ? 'OK  ' : 'FAIL';
  if (!c.ok) failed += 1;
  console.log(`${mark}  ${c.name}: ${c.detail}`);
}

console.log('');
for (const c of optional) {
  const mark = c.ok ? 'OK  ' : 'SKIP';
  console.log(`${mark}  ${c.name}: ${c.detail}`);
}

console.log('');
if (failed > 0) {
  console.log(
    `Blocked: ${failed} required check(s) failed. See docs/engineering/runbooks/OPS-001-phase0-tooling.md`,
  );
  process.exitCode = 1;
} else {
  console.log('Ready for OPS-001 Phases A–E (accounts + deploy).');
}
