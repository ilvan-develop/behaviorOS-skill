#!/usr/bin/env node

/**
 * behaviorOS - fail-closed CI step runner
 *
 * Usage: node scripts/ci-run.mjs <script-name>
 *
 * Runs one package.json script and propagates its exit code. Skips — with exit 0 — only when
 * the script genuinely is not configured.
 *
 * This exists because the CI workflow used to express "skip if not configured" as:
 *
 *     (pnpm test || npm test) 2>/dev/null || echo "No test script configured, skipping"
 *
 * `||` cannot tell "the script is absent" from "the script ran and failed": both are non-zero,
 * so both fell through to `echo`, the step exited 0, and CI went green on failing tests. The
 * `2>/dev/null` then hid the reason. A CI that cannot fail is not an authority, which is the
 * one thing the OAGE model asks of it (§34-36, §60).
 *
 * The decision is therefore made by INSPECTING package.json, never by interpreting an exit
 * code — absence is known before anything runs, so a non-zero exit can only ever mean failure.
 */

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Which package manager the project actually uses, decided by its lockfile. */
export function detectPackageManager(cwd = process.cwd()) {
  if (existsSync(`${cwd}/pnpm-lock.yaml`)) return 'pnpm';
  if (existsSync(`${cwd}/yarn.lock`)) return 'yarn';
  return 'npm';
}

/**
 * Is `name` a configured script in this project?
 * @returns {{ configured: boolean, reason?: string }}
 */
export function scriptStatus(name, cwd = process.cwd()) {
  const manifest = `${cwd}/package.json`;
  if (!existsSync(manifest)) return { configured: false, reason: 'no package.json' };
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(manifest, 'utf8'));
  } catch (error) {
    // A malformed manifest is a failure, not an absence — do not let it read as "skip".
    return { configured: false, reason: `unreadable package.json: ${error.message}`, fatal: true };
  }
  const script = pkg.scripts?.[name];
  if (typeof script !== 'string' || script.trim() === '') {
    return { configured: false, reason: 'not configured' };
  }
  return { configured: true, command: script };
}

function main() {
  const scriptName = process.argv[2];
  if (!scriptName) {
    console.error('Usage: node scripts/ci-run.mjs <script-name>');
    process.exit(2);
  }

  const cwd = process.cwd();
  const status = scriptStatus(scriptName, cwd);

  if (status.fatal) {
    console.error(`[ci-run] FAIL ${scriptName} — ${status.reason}`);
    process.exit(1);
  }

  if (!status.configured) {
    console.log(`[ci-run] SKIP ${scriptName} — ${status.reason}`);
    process.exit(0);
  }

  const pm = detectPackageManager(cwd);
  console.log(`[ci-run] RUN  ${pm} run ${scriptName}  (${status.command})`);

  const result = spawnSync(pm, ['run', scriptName], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    console.error(`[ci-run] FAIL ${scriptName} — could not start ${pm}: ${result.error.message}`);
    process.exit(1);
  }

  // A signal death (OOM, timeout kill) is a failure, and carries no exit code of its own.
  if (result.signal) {
    console.error(`[ci-run] FAIL ${scriptName} — terminated by ${result.signal}`);
    process.exit(1);
  }

  const code = result.status ?? 1;
  console.log(code === 0 ? `[ci-run] PASS ${scriptName}` : `[ci-run] FAIL ${scriptName} (exit ${code})`);
  process.exit(code);
}

// Only run when invoked as a CLI, so the helpers above stay importable from tests.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
