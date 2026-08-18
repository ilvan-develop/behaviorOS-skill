#!/usr/bin/env node

/**
 * behaviorOS - tool-gate.json adversarial tests
 *
 * tool-gate.json is consumed twice:
 *   1. .opencode/plugins/oage-enforce.js — ONLY for the 'git-commit' rule, as a pre-commit
 *      QUALITY_GATE. That path is deliberately AUDIT-ONLY (event quality_gate_check): the
 *      kernel records which required checks must have run, and the actual check runs
 *      client-side/CI. It does NOT throw. The kernel-side tests below assert that reality —
 *      the audit event fires, and the call is NOT blocked.
 *   2. scripts/guards/tool-guard.ps1 — where the block/deny/ask actions are actually
 *      enforced, fail-closed. Those are PowerShell, so they are tested via subprocess.
 *
 * The adversarial guarantee splits accordingly: the kernel proves the rule is consumed and
 * the quality-gate audit is recorded; the guard proves a violating tool call is blocked and
 * a legitimate one passes. If the kernel's git-commit handling were a hard block, that would
 * be an invention, so no test asserts one.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, cpSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { OageEnforce } from '../.opencode/plugins/oage-enforce.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

let FIXTURE;
let hook;
let callSeq = 0;

function findPowerShell() {
  const candidates = process.platform === 'win32' ? ['powershell.exe', 'pwsh'] : ['pwsh', 'powershell.exe'];
  for (const bin of candidates) {
    const r = spawnSync(bin, ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' });
    if (r.status === 0) return bin;
  }
  return null;
}

const PS = findPowerShell();

function runToolGuard(args) {
  const extra = process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass'] : [];
  return spawnSync(PS, ['-NoProfile', '-NonInteractive', ...extra, '-File', join(ROOT_DIR, 'scripts', 'guards', 'tool-guard.ps1'), ...args], {
    cwd: FIXTURE,
    encoding: 'utf8',
  });
}

async function attempt(tool, args, sessionID) {
  callSeq += 1;
  try {
    await hook({ tool, sessionID, callID: `call-${callSeq}` }, { args });
    return null;
  } catch (error) {
    return error;
  }
}

function auditEvents() {
  const file = join(FIXTURE, '.opencode', 'audit', 'audit.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

before(async () => {
  FIXTURE = join(tmpdir(), `oage-tool-gate-${process.pid}`);
  rmSync(FIXTURE, { recursive: true, force: true });
  mkdirSync(join(FIXTURE, '.opencode', 'governance'), { recursive: true });

  cpSync(join(ROOT_DIR, 'templates', 'base', 'governance'), join(FIXTURE, '.opencode', 'governance'), { recursive: true });
  cpSync(join(ROOT_DIR, 'templates', 'fintech', 'governance', 'tool-gate.json'), join(FIXTURE, '.opencode', 'governance', 'tool-gate.json'));
  writeFileSync(join(FIXTURE, '.opencode', 'governance', 'state-machine.json'), JSON.stringify({ currentState: 'F0' }));

  const plugin = await OageEnforce({ directory: FIXTURE });
  hook = plugin['tool.execute.before'];
});

after(() => {
  rmSync(FIXTURE, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kernel: the 'git-commit' QUALITY_GATE rule is consumed and audited, not blocked
// ─────────────────────────────────────────────────────────────────────────────

describe('tool-gate.json — kernel git-commit QUALITY_GATE (audit-only)', () => {
  it('records a quality_gate_check audit for a git commit, naming the required checks', async () => {
    const error = await attempt('bash', { command: 'git commit -m "feat: x"' }, 'tg-commit');
    assert.equal(error, null, `git commit is audited, not blocked, got: ${error?.message}`);

    const gate = auditEvents().find((e) => e.event === 'quality_gate_check');
    assert.ok(gate, 'no quality_gate_check event recorded for a git commit');
    assert.equal(gate.gate, 'quality-gates');
    assert.deepEqual(gate.checks, ['lint', 'typecheck', 'test', 'coverage']);
  });

  it('does not fabricate a quality_gate_check audit for a plain bash call', async () => {
    const baseline = auditEvents().filter((e) => e.event === 'quality_gate_check').length;
    const error = await attempt('bash', { command: 'ls -la' }, 'tg-plain');
    assert.equal(error, null, `plain bash must pass, got: ${error?.message}`);
    const after = auditEvents().filter((e) => e.event === 'quality_gate_check').length;
    assert.strictEqual(after, baseline, 'only git commit should trigger the quality-gate audit');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tool-guard.ps1: the fail-closed enforcement of block/deny/ask rules
// ─────────────────────────────────────────────────────────────────────────────

describe('tool-gate.json — scripts/guards/tool-guard.ps1 (subprocess)', () => {
  function guardCase(t, name, args, expectStatus) {
    if (!PS) {
      t.skip('no PowerShell available on this host');
      return null;
    }
    const result = runToolGuard(args);
    assert.strictEqual(result.status, expectStatus, `${name}: stdout=${result.stdout} stderr=${result.stderr}`);
    return result;
  }

  it('blocks a git commit (rule git-commit, action block)', (t) => {
    const r = guardCase(t, 'git commit', ['-Tool', 'bash', '-Command', 'git commit -m "test"'], 1);
    if (r) assert.match(r.stdout, /\[BLOCKED\]/);
  });

  it('denies an rm -rf command (rule destructive, action deny)', (t) => {
    const r = guardCase(t, 'rm -rf', ['-Tool', 'bash', '-Command', 'rm -rf build/'], 1);
    if (r) assert.match(r.stdout, /\[BLOCKED\]/);
  });

  it('blocks a git push (rule git-push, action ask requires approval)', (t) => {
    const r = guardCase(t, 'git push', ['-Tool', 'bash', '-Command', 'git push origin main'], 1);
    if (r) assert.match(r.stdout, /\[ASK\]/);
  });

  it('blocks a write to a prisma schema (rule prisma-schema, action ask)', (t) => {
    const r = guardCase(t, 'prisma write', ['-Tool', 'write', '-File', 'prisma/schema.prisma'], 1);
    if (r) assert.match(r.stdout, /\[ASK\]/);
  });

  it('allows a benign command that matches no rule', (t) => {
    const r = guardCase(t, 'npm test', ['-Tool', 'bash', '-Command', 'npm test'], 0);
    if (r) assert.match(r.stdout, /\[PASS\]/);
  });

  it('records the blocked call in the audit with a valid phase instead of crashing the audit logger', (t) => {
    if (!PS) {
      t.skip('no PowerShell available on this host');
      return;
    }
    const r = runToolGuard(['-Tool', 'bash', '-Command', 'rm -rf build/']);
    assert.strictEqual(r.status, 1, `the block must still exit 1, got: ${r.stdout}`);
    assert.doesNotMatch(r.stderr, /ValidateSet/, 'the audit call must not crash on an invalid phase');
    const blocked = auditEvents().find((e) => e.event === 'tool_call' && e.gate === 'tool' && e.result === 'BLOCKED');
    assert.ok(blocked, 'the blocked call must be recorded in the audit trail');
    assert.match(blocked.phase, /^F[0-6]$/, `the recorded phase must be a valid pipeline phase, got: ${blocked.phase}`);
  });
});
