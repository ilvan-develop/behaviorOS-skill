#!/usr/bin/env node

/**
 * behaviorOS - permissions-matrix.json adversarial tests
 *
 * permissions-matrix.json is the handoff/phase authority. It is deliberately NOT a kernel
 * policy — the runtime tool.execute.before hook carries no agent identity, so only a guard
 * that receives an explicit agent can apply allowedAgents. Its only consumer is
 * scripts/guards/permission-guard.ps1 (PowerShell). That is pure PowerShell, so this suite
 * tests the guard's REAL behaviour via subprocess against a throwaway project seeded with
 * the shipped template policy — not a Node reimplementation of its logic.
 *
 * The tests assert the fail-closed cases (agent not allowed, approval required) AND the
 * pass case (allowed agent), plus the honest failure shape: when permissions-matrix.json is
 * missing or lacks the phase, the guard fails OPEN (exit 0), which contradicts the
 * contract's declared failureMode "fail-closed". That fallback is pinned here so it stays
 * visible rather than being silently "assumed" to be a block.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, rmSync, writeFileSync, cpSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

let FIXTURE;
let EMPTY_FIXTURE;

function findPowerShell() {
  const candidates = process.platform === 'win32' ? ['powershell.exe', 'pwsh'] : ['pwsh', 'powershell.exe'];
  for (const bin of candidates) {
    const r = spawnSync(bin, ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' });
    if (r.status === 0) return bin;
  }
  return null;
}

const PS = findPowerShell();

function runPermissionGuard(cwd, args) {
  const extra = process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass'] : [];
  return spawnSync(PS, ['-NoProfile', '-NonInteractive', ...extra, '-File', join(ROOT_DIR, 'scripts', 'guards', 'permission-guard.ps1'), ...args], {
    cwd,
    encoding: 'utf8',
  });
}

before(() => {
  FIXTURE = join(tmpdir(), `oage-permissions-matrix-${process.pid}`);
  EMPTY_FIXTURE = join(tmpdir(), `oage-permissions-empty-${process.pid}`);
  rmSync(FIXTURE, { recursive: true, force: true });
  rmSync(EMPTY_FIXTURE, { recursive: true, force: true });
  mkdirSync(join(FIXTURE, '.opencode', 'governance'), { recursive: true });
  mkdirSync(EMPTY_FIXTURE, { recursive: true });
  cpSync(join(ROOT_DIR, 'templates', 'fintech', 'governance', 'permissions-matrix.json'), join(FIXTURE, '.opencode', 'governance', 'permissions-matrix.json'));
});

after(() => {
  rmSync(FIXTURE, { recursive: true, force: true });
  rmSync(EMPTY_FIXTURE, { recursive: true, force: true });
});

describe('permissions-matrix.json — scripts/guards/permission-guard.ps1 (subprocess)', () => {
  function guardCase(t, args, expectStatus) {
    if (!PS) {
      t.skip('no PowerShell available on this host');
      return null;
    }
    const result = runPermissionGuard(FIXTURE, args);
    assert.strictEqual(result.status, expectStatus, `stdout=${result.stdout} stderr=${result.stderr}`);
    return result;
  }

  it('allows an agent listed in the phase allowedAgents', (t) => {
    const r = guardCase(t, ['-Agent', 'backend', '-Phase', 'F1'], 0);
    if (r) assert.match(r.stdout, /\[PASS\]/);
  });

  it('allows orchestrator in F0 (allowedAgents includes orchestrator)', (t) => {
    const r = guardCase(t, ['-Agent', 'orchestrator', '-Phase', 'F0'], 0);
    if (r) assert.match(r.stdout, /\[PASS\]/);
  });

  it('blocks an agent absent from the phase allowedAgents (fail-closed)', (t) => {
    const r = guardCase(t, ['-Agent', 'compliance', '-Phase', 'F0'], 1);
    if (r) assert.match(r.stdout, /\[BLOCKED\]/);
  });

  it('blocks an agent not allowed in a critical phase (planner, F2)', (t) => {
    const r = guardCase(t, ['-Agent', 'planner', '-Phase', 'F2'], 1);
    if (r) assert.match(r.stdout, /\[BLOCKED\]/);
  });

  it('blocks an allowed agent when the phase requires approvals (F2 requiredApprovals 1)', (t) => {
    const r = guardCase(t, ['-Agent', 'backend', '-Phase', 'F2'], 1);
    if (r) {
      assert.match(r.stdout, /\[ASK\]/);
      assert.match(r.stdout, /\[BLOCKED\]/);
    }
  });

  it('fails OPEN (exit 0) when permissions-matrix.json is missing — contradicts declared fail-closed', (t) => {
    if (!PS) {
      t.skip('no PowerShell available on this host');
      return;
    }
    const result = runPermissionGuard(EMPTY_FIXTURE, ['-Agent', 'compliance', '-Phase', 'F0']);
    assert.strictEqual(result.status, 0, `expected permissive fallback, got: ${result.stdout}`);
    assert.match(result.stdout, /\[WARN\]/);
  });
});
