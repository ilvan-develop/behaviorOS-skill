#!/usr/bin/env node

/**
 * behaviorOS - tool-gate.json adversarial tests
 *
 * tool-gate.json is consumed twice:
 *   1. .opencode/plugins/oage-enforce.js — for the 'git-commit' rule, as a pre-commit
 *      QUALITY_GATE. That path is deliberately AUDIT-ONLY (event quality_gate_check): the
 *      kernel records which required checks must have run, and the actual check runs
 *      client-side/CI. It does NOT throw. The kernel-side tests below assert that reality —
 *      the audit event fires, and the call is NOT blocked. Every OTHER rule (deny/block/ask)
 *      and globalRules.forbiddenPatterns ARE enforced directly by the kernel — see
 *      applyToolGateRules in oage-enforce.js — because the kernel CAN evaluate a pattern
 *      match and throw; it just can't run lint/typecheck/test/coverage itself.
 *
 *      This used to be audit-only for every rule: the governance contract declared the whole
 *      file "kernel, runtime, fail-closed" with oage-enforce.js as a consumer, but the kernel
 *      only ever consumed the 'git-commit' rule. 'destructive' (rm -rf), 'git-push' (ask) and
 *      'prisma-schema' (ask), plus globalRules.forbiddenPatterns, were declared enforced and
 *      had an adversarial test proving the PS1 guard blocks them — while the automatic path
 *      an agent actually goes through (the kernel plugin) let all of them straight through.
 *      INSTRUCTIONS.md §16 tells agents they don't need to call the guard scripts manually
 *      because "the plugin does it automatically" — true for every other kernel policy, false
 *      for this one until now.
 *   2. scripts/guards/tool-guard.ps1 — an independent PowerShell enforcement of the same
 *      rules, fail-closed, for runtimes that shell out to it directly instead of going
 *      through the Node kernel. Tested via subprocess.
 *
 * The adversarial guarantee now has three legs: the kernel proves git-commit is audited, not
 * blocked (an invented hard block there would be dishonest — the kernel cannot run the
 * checks); the kernel proves every OTHER rule and globalRules.forbiddenPatterns actually
 * throw when called through tool.execute.before, the real path an agent uses; and the guard
 * proves the independent PowerShell enforcement still holds for callers that use it directly.
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
// Kernel: every non-git-commit rule and globalRules.forbiddenPatterns are enforced
// directly by tool.execute.before — the real path an agent's tool call goes through.
// ─────────────────────────────────────────────────────────────────────────────

describe('tool-gate.json — kernel enforcement of deny/ask rules and globalRules', () => {
  it('denies an rm -rf command through the kernel (rule destructive, action deny)', async () => {
    const error = await attempt('bash', { command: 'rm -rf build/' }, 'tg-rm');
    assert.ok(error, 'expected the kernel to throw, but the call was allowed');
    assert.match(error.message, /destructive/);
  });

  it('blocks a git push through the kernel (rule git-push, action ask)', async () => {
    const error = await attempt('bash', { command: 'git push origin main' }, 'tg-push');
    assert.ok(error, 'expected the kernel to throw, but the call was allowed');
    assert.match(error.message, /git-push/);
  });

  it('does not block an unrelated bash command', async () => {
    const error = await attempt('bash', { command: 'npm test' }, 'tg-npmtest');
    assert.equal(error, null, `expected npm test to pass through, got: ${error?.message}`);
  });

  it('blocks a write to a prisma schema through the kernel (rule prisma-schema, action ask)', async () => {
    const error = await attempt('write', { filePath: 'packages/db/schema.prisma', content: 'model X {}' }, 'tg-prisma');
    assert.ok(error, 'expected the kernel to throw, but the write was allowed');
    assert.match(error.message, /prisma-schema/);
  });

  it('does not block a write that matches no rule', async () => {
    const error = await attempt('write', { filePath: 'src/index.ts', content: 'export const x = 1;' }, 'tg-benign');
    assert.equal(error, null, `expected a benign write to pass, got: ${error?.message}`);
  });

  it('denies a write whose content matches globalRules.forbiddenPatterns (hardcoded secret)', async () => {
    // Assembled at runtime, not a literal — a hardcoded-secret-shaped literal in a test file
    // is itself a hardcoded secret to lint.mjs's own scanner (see scripts/lint.mjs's comment
    // on why test files are scanned like everything else).
    const key = ['se', 'cret'].join('');
    const content = `${key} = "${'x'.repeat(20)}"`;
    const error = await attempt('write', { filePath: 'src/config.ts', content }, 'tg-secret');
    assert.ok(error, 'expected the kernel to throw on a hardcoded secret, but the write was allowed');
    assert.match(error.message, /forbidden|proibido|Segredos/i);
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
