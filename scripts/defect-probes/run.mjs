#!/usr/bin/env node
// Defect-reintroduction probes.
//
// Each *.patch in this directory re-introduces one of the 12 defects found in
// the June 2026 audit (docs/audit-report-2026-06.md; table 1 of
// docs/test-suite-benchmark-2026-06.md). A probe is KILLED when the test suite
// fails with the patch applied, and SURVIVES when the suite still passes. Every
// probe must be killed: a survivor means the suite has lost the ability to
// catch a defect that once shipped under a green build.
//
// The probes run against the committed HEAD in a disposable git worktree, so
// the working tree is never modified (uncommitted changes are not probed).
//
// Usage: node scripts/defect-probes/run.mjs [--only P03,P07] [--keep-worktree]
// Exit code: 0 if the unpatched suite passes and every probe is killed,
// 1 otherwise.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const probeDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(probeDir, '..', '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const keepWorktree = args.includes('--keep-worktree');

// The suite each probe must break: the vitest suite (`npm run test:run`)
// minus the wall-clock performance canaries (vitest.stryker.config.ts, the
// same suite Stryker uses). Those have ~10x headroom but can
// still fail on a heavily loaded machine, and a probe must be killed by a
// correctness assertion, not by a timing flake (none of the 12 defects is a
// performance regression).
const TEST_COMMAND = ['npx', ['vitest', 'run', '--reporter=dot', '--config', 'vitest.stryker.config.ts']];

function run(cmd, cmdArgs, cwd, { stdio = 'pipe' } = {}) {
  const result = spawnSync(cmd, cmdArgs, { cwd, encoding: 'utf8', stdio, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  // A signal (timeout, OOM kill) is not a test failure; never count it as a kill.
  if (result.signal) throw new Error(`${cmd} ${cmdArgs.join(' ')} was killed by ${result.signal}`);
  return result;
}

function git(cwd, ...gitArgs) {
  const result = run('git', gitArgs, cwd);
  if (result.status !== 0) {
    throw new Error(`git ${gitArgs.join(' ')} failed:\n${result.stderr}`);
  }
  return result.stdout;
}

function runSuite(cwd) {
  const [cmd, cmdArgs] = TEST_COMMAND;
  // Test output is discarded: only the exit status matters here. Re-run a
  // single probe with --only <id> --keep-worktree to investigate it.
  return run(cmd, cmdArgs, cwd, { stdio: 'ignore' }).status;
}

const patches = readdirSync(probeDir)
  .filter((name) => name.endsWith('.patch'))
  .filter((name) => !only || only.some((id) => name.startsWith(id)))
  .sort();

if (patches.length === 0) {
  console.error('No probe patches selected.');
  process.exit(1);
}

const worktree = mkdtempSync(join(tmpdir(), 'garten-probes-'));
rmSync(worktree, { recursive: true, force: true });
git(repoRoot, 'worktree', 'add', '--detach', worktree, 'HEAD');
symlinkSync(join(repoRoot, 'node_modules'), join(worktree, 'node_modules'), 'dir');

const results = [];
let exitCode = 0;
try {
  console.log(`Baseline: running the unpatched suite at ${git(worktree, 'rev-parse', '--short', 'HEAD').trim()}...`);
  const baseline = runSuite(worktree);
  if (baseline !== 0) {
    throw new Error(`Baseline suite failed (exit ${baseline}); probe results would be meaningless.`);
  }

  for (const patch of patches) {
    const id = basename(patch, '.patch');
    const patchPath = join(probeDir, patch);
    const check = run('git', ['apply', '--check', patchPath], worktree);
    if (check.status !== 0) {
      results.push({ id, outcome: 'STALE (patch no longer applies)' });
      exitCode = 1;
      continue;
    }
    git(worktree, 'apply', patchPath);
    try {
      const status = runSuite(worktree);
      const killed = status !== 0;
      results.push({ id, outcome: killed ? 'killed' : 'SURVIVED' });
      if (!killed) exitCode = 1;
    } finally {
      git(worktree, 'checkout', '--', '.');
    }
    console.log(`${id}: ${results.at(-1).outcome}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  exitCode = 1;
} finally {
  if (keepWorktree) {
    console.log(`Worktree kept at ${worktree}`);
  } else {
    git(repoRoot, 'worktree', 'remove', '--force', worktree);
  }
}

const killed = results.filter((r) => r.outcome === 'killed').length;
console.log('\nDefect-reintroduction probes');
for (const { id, outcome } of results) console.log(`  ${outcome.padEnd(32)} ${id}`);
console.log(`\nKilled ${killed}/${results.length}.`);
process.exit(exitCode);
