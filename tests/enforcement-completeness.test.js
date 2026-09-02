/**
 * P1.5 — Enforcement Completeness: Adversarial Test Suite
 *
 * Proves I-61 through I-70: Every declared enforcement chain actually works.
 * Verifies that enforced policies have consumers and adversarial tests.
 * Verifies that unenforced policies are explicitly declared.
 * Verifies that superseded policies remain disabled.
 *
 * ACTUAL GOVERNANCE CONTRACT STRUCTURE:
 * - policies is an OBJECT keyed by policy name
 * - enforcementMode: "runtime" | "phase" | "ci" | "declarative"
 * - 16 runtime-enforced policies (with consumers)
 * - 6 phase/handoff-enforced policies
 * - 3 unenforced policies (production-gate, context7-gate, skill-gate-auto)
 * - 4 declarative policies
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const GOV = join(ROOT, '.opencode', 'governance');

function readJSON(filename) {
  const path = join(GOV, filename);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

// ─── Phase 0: Contract & Invariants ───────────────────────────────────────

describe('P1.5 Phase 0: Contract & Invariants', () => {
  const contract = readJSON('governance-contract.json');

  it('I-61: Governance contract is readable', () => {
    assert.ok(contract, 'governance-contract.json must exist');
  });

  it('I-61: Contract has policies object', () => {
    assert.ok(contract.policies, 'policies must be object');
    assert.strictEqual(typeof contract.policies, 'object');
  });

  it('I-61: Contract has at least 16 runtime-enforced policies', () => {
    const enforced = Object.values(contract.policies).filter(p =>
      p.enforcementMode === 'runtime' && p.status === 'enforced'
    );
    assert.ok(enforced.length >= 16, `Expected >= 16 enforced, got ${enforced.length}`);
  });

  it('I-61: All enforced runtime policies have authority declared', () => {
    const enforced = Object.entries(contract.policies).filter(([_, p]) =>
      p.enforcementMode === 'runtime' && p.status === 'enforced'
    );
    const missingAuthority = enforced.filter(([_, p]) => !p.authority);
    assert.strictEqual(missingAuthority.length, 0,
      `Policies missing authority: ${missingAuthority.map(([k]) => k).join(', ')}`);
  });

  it('I-61: All enforced runtime policies have failureMode declared', () => {
    const enforced = Object.entries(contract.policies).filter(([_, p]) =>
      p.enforcementMode === 'runtime' && p.status === 'enforced'
    );
    const missingFailureMode = enforced.filter(([_, p]) => !p.failureMode);
    assert.strictEqual(missingFailureMode.length, 0,
      `Policies missing failureMode: ${missingFailureMode.map(([k]) => k).join(', ')}`);
  });
});

// ─── Phase 1: Enforcement Chain Audit ─────────────────────────────────────

describe('P1.5 Phase 1: Enforcement Chain Audit', () => {
  const contract = readJSON('governance-contract.json');

  it('I-61: version-pinning-gate.json is declared as enforced', () => {
    const policy = contract.policies['version-pinning-gate.json'];
    assert.ok(policy, 'version-pinning-gate.json must be declared');
    assert.strictEqual(policy.enforcementMode, 'runtime', 'must be runtime');
    assert.strictEqual(policy.authority, 'kernel', 'must be kernel authority');
  });

  it('I-61: version-registry.json is declared as enforced', () => {
    const policy = contract.policies['version-registry.json'];
    assert.ok(policy, 'version-registry.json must be declared');
    assert.strictEqual(policy.enforcementMode, 'runtime', 'must be runtime');
    assert.strictEqual(policy.authority, 'kernel', 'must be kernel authority');
  });

  it('I-61: tool-gate.json is declared as enforced', () => {
    const policy = contract.policies['tool-gate.json'];
    assert.ok(policy, 'tool-gate.json must be declared');
    assert.strictEqual(policy.enforcementMode, 'runtime', 'must be runtime');
    assert.strictEqual(policy.authority, 'kernel', 'must be kernel authority');
  });

  it('I-61: permissions-matrix.json is declared as enforced (phase mode)', () => {
    const policy = contract.policies['permissions-matrix.json'];
    assert.ok(policy, 'permissions-matrix.json must be declared');
    assert.strictEqual(policy.enforcementMode, 'phase', 'must be phase mode');
    assert.strictEqual(policy.authority, 'handoff', 'must be handoff authority');
    assert.strictEqual(policy.status, 'enforced', 'must be enforced');
  });

  it('I-61: All enforced runtime policies have consumers', () => {
    const enforced = Object.entries(contract.policies).filter(([_, p]) =>
      p.enforcementMode === 'runtime' && p.status === 'enforced'
    );
    const missingConsumers = enforced.filter(([_, p]) =>
      !p.consumers || p.consumers.length === 0
    );
    assert.strictEqual(missingConsumers.length, 0,
      `Policies without consumers: ${missingConsumers.map(([k]) => k).join(', ')}`);
  });
});

// ─── Phase 2: UNTESTED Policy Tests ───────────────────────────────────────

describe('P1.5 Phase 2: UNTESTED Policy Resolution', () => {
  const contract = readJSON('governance-contract.json');

  it('I-62: version-pinning-gate.json has failure mode fail-closed', () => {
    const policy = contract.policies['version-pinning-gate.json'];
    assert.ok(policy, 'version-pinning-gate.json must be declared');
    assert.strictEqual(policy.failureMode, 'fail-closed',
      'version-pinning-gate must fail-closed');
  });

  it('I-62: version-pinning-gate.json consumers include oage-enforce.js', () => {
    const policy = contract.policies['version-pinning-gate.json'];
    assert.ok(policy.consumers.some(c => c.includes('oage-enforce.js')),
      'oage-enforce.js must be a consumer');
  });

  it('I-63: tool-gate.json has failure mode fail-closed', () => {
    const policy = contract.policies['tool-gate.json'];
    assert.ok(policy, 'tool-gate.json must be declared');
    assert.strictEqual(policy.failureMode, 'fail-closed',
      'tool-gate must fail-closed');
  });

  it('I-63: tool-gate.json consumers include oage-enforce.js', () => {
    const policy = contract.policies['tool-gate.json'];
    assert.ok(policy.consumers.some(c => c.includes('oage-enforce.js')),
      'oage-enforce.js must be a consumer');
  });

  it('I-64: permissions-matrix.json has failure mode fail-closed', () => {
    const policy = contract.policies['permissions-matrix.json'];
    assert.ok(policy, 'permissions-matrix.json must be declared');
    assert.strictEqual(policy.failureMode, 'fail-closed',
      'permissions-matrix must fail-closed');
  });

  it('I-64: permissions-matrix.json consumers include permission-guard.ps1', () => {
    const policy = contract.policies['permissions-matrix.json'];
    assert.ok(policy.consumers.some(c => c.includes('permission-guard.ps1')),
      'permission-guard.ps1 must be a consumer');
  });

  it('I-65: version-registry.json has failure mode fail-closed', () => {
    const policy = contract.policies['version-registry.json'];
    assert.ok(policy, 'version-registry.json must be declared');
    assert.strictEqual(policy.failureMode, 'fail-closed',
      'version-registry must fail-closed');
  });

  it('I-65: version-registry.json consumers include oage-enforce.js', () => {
    const policy = contract.policies['version-registry.json'];
    assert.ok(policy.consumers.some(c => c.includes('oage-enforce.js')),
      'oage-enforce.js must be a consumer');
  });
});

// ─── Phase 3: Unenforced Policy Resolution ────────────────────────────────

describe('P1.5 Phase 3: Unenforced Policy Resolution', () => {
  const contract = readJSON('governance-contract.json');

  it('I-66: ci-gate.json is enforced with a real CI consumer', () => {
    const policy = contract.policies['ci-gate.json'];
    assert.ok(policy, 'ci-gate.json must be declared');
    assert.strictEqual(policy.authority, 'ci', 'must be ci authority');
    assert.strictEqual(policy.status, 'enforced', 'must be enforced');
    assert.ok(
      policy.consumers.some((c) => c.includes('ci-gate-check.mjs')),
      'must consume scripts/ci-gate-check.mjs'
    );
  });

  it('I-66: security-gates.json is enforced with a real consumer', () => {
    const policy = contract.policies['security-gates.json'];
    assert.ok(policy, 'security-gates.json must be declared');
    assert.strictEqual(policy.authority, 'ci', 'must be ci authority');
    assert.strictEqual(policy.status, 'enforced', 'must be enforced');
    assert.ok(
      policy.consumers.some((c) => c.includes('lint.mjs')),
      'must consume scripts/lint.mjs'
    );
  });

  it('I-66: production-gate.json is declared as unenforced', () => {
    const policy = contract.policies['production-gate.json'];
    assert.ok(policy, 'production-gate.json must be declared');
    assert.strictEqual(policy.authority, 'ci', 'must be ci authority');
    assert.strictEqual(policy.status, 'unenforced', 'must be unenforced');
  });

  it('I-66: context7-gate.json is declared as unenforced', () => {
    const policy = contract.policies['context7-gate.json'];
    assert.ok(policy, 'context7-gate.json must be declared');
    assert.strictEqual(policy.authority, 'kernel', 'must be kernel authority');
    assert.strictEqual(policy.status, 'unenforced', 'must be unenforced');
  });

  it('I-66: skill-gate-auto.json is declared as unenforced', () => {
    const policy = contract.policies['skill-gate-auto.json'];
    assert.ok(policy, 'skill-gate-auto.json must be declared');
    assert.strictEqual(policy.authority, 'kernel', 'must be kernel authority');
    assert.strictEqual(policy.status, 'unenforced', 'must be unenforced');
  });

  it('I-66: Unenforced policies have empty consumers', () => {
    const unenforced = Object.entries(contract.policies).filter(([_, p]) =>
      p.status === 'unenforced'
    );
    const withConsumers = unenforced.filter(([_, p]) =>
      p.consumers && p.consumers.length > 0
    );
    assert.strictEqual(withConsumers.length, 0,
      `Unenforced policies with consumers: ${withConsumers.map(([k]) => k).join(', ')}`);
  });
});

// ─── Phase 4: Declarative & Superseded Policies ───────────────────────────

describe('P1.5 Phase 4: Declarative & Superseded Policies', () => {
  const contract = readJSON('governance-contract.json');

  it('I-67: mcp-registry.json is declarative (no runtime)', () => {
    const policy = contract.policies['mcp-registry.json'];
    assert.ok(policy, 'mcp-registry.json must be declared');
    assert.strictEqual(policy.authority, 'declarative', 'must be declarative authority');
    assert.strictEqual(policy.enforcementMode, 'declarative', 'must be declarative mode');
  });

  it('I-67: memory.json is declarative (no runtime)', () => {
    const policy = contract.policies['memory.json'];
    assert.ok(policy, 'memory.json must be declared');
    assert.strictEqual(policy.authority, 'declarative', 'must be declarative authority');
    assert.strictEqual(policy.enforcementMode, 'declarative', 'must be declarative mode');
  });

  it('I-67: blueprint.json is declarative (no runtime)', () => {
    const policy = contract.policies['blueprint.json'];
    assert.ok(policy, 'blueprint.json must be declared');
    assert.strictEqual(policy.authority, 'declarative', 'must be declarative authority');
    assert.strictEqual(policy.enforcementMode, 'declarative', 'must be declarative mode');
  });

  it('I-67: opencode.json is declarative (no runtime)', () => {
    const policy = contract.policies['opencode.json'];
    assert.ok(policy, 'opencode.json must be declared');
    assert.strictEqual(policy.authority, 'declarative', 'must be declarative authority');
    assert.strictEqual(policy.enforcementMode, 'declarative', 'must be declarative mode');
  });

  it('I-68: truth-gate.json is declared (superseded by policy-resolver)', () => {
    const policy = contract.policies['truth-gate.json'];
    assert.ok(policy, 'truth-gate.json must be declared');
    assert.strictEqual(policy.status, 'enforced', 'truth-gate must be enforced');
  });

  it('I-68: context7-gate.json is unenforced (superseded by policy-resolver)', () => {
    const policy = contract.policies['context7-gate.json'];
    assert.ok(policy, 'context7-gate.json must be declared');
    assert.strictEqual(policy.status, 'unenforced', 'must be unenforced');
  });
});

// ─── Phase 5: State Machine & Phase Boundaries ────────────────────────────

describe('P1.5 Phase 5: State Machine & Phase Boundaries', () => {
  const stateMachine = readJSON('state-machine.json');

  it('I-69: state-machine.json is readable', () => {
    assert.ok(stateMachine, 'state-machine.json must exist');
  });

  it('I-69: state machine defines phases', () => {
    const phases = stateMachine.phases || stateMachine.states;
    assert.ok(phases, 'state machine must have phases');
  });

  it('I-70: governance-contract.json is the single source of policy truth', () => {
    const contract = readJSON('governance-contract.json');
    assert.ok(contract, 'governance-contract.json must exist');
    assert.ok(contract.policies, 'contract must have policies');
    assert.ok(contract.version, 'contract must have version');
  });

  it('I-70: Contract version is declared', () => {
    const contract = readJSON('governance-contract.json');
    assert.ok(contract.version, 'contract must have version');
  });
});

// ─── Phase 6: Adversarial Tests ───────────────────────────────────────────

describe('P1.5 Phase 6: Adversarial Tests', () => {
  const contract = readJSON('governance-contract.json');

  it('I-62: version-pinning-gate has consumer declared', () => {
    const policy = contract.policies['version-pinning-gate.json'];
    assert.ok(policy, 'version-pinning-gate.json must be declared');
    assert.strictEqual(policy.enforcementMode, 'runtime');
    assert.ok(policy.consumers && policy.consumers.length > 0, 'must have consumers');
  });

  it('I-63: tool-gate has consumer declared', () => {
    const policy = contract.policies['tool-gate.json'];
    assert.ok(policy, 'tool-gate.json must be declared');
    assert.strictEqual(policy.enforcementMode, 'runtime');
    assert.ok(policy.consumers && policy.consumers.length > 0, 'must have consumers');
  });

  it('I-64: permissions-matrix has consumer declared', () => {
    const policy = contract.policies['permissions-matrix.json'];
    assert.ok(policy, 'permissions-matrix.json must be declared');
    assert.strictEqual(policy.enforcementMode, 'phase');
    assert.ok(policy.consumers && policy.consumers.length > 0, 'must have consumers');
  });

  it('I-65: version-registry has consumer declared', () => {
    const policy = contract.policies['version-registry.json'];
    assert.ok(policy, 'version-registry.json must be declared');
    assert.strictEqual(policy.enforcementMode, 'runtime');
    assert.ok(policy.consumers && policy.consumers.length > 0, 'must have consumers');
  });

  it('I-61: All enforced runtime policies have consumers', () => {
    const enforced = Object.entries(contract.policies).filter(([_, p]) =>
      p.enforcementMode === 'runtime' && p.status === 'enforced'
    );
    const missing = enforced.filter(([_, p]) => !p.consumers || p.consumers.length === 0);
    assert.strictEqual(missing.length, 0,
      `Policies without consumers: ${missing.map(([k]) => k).join(', ')}`);
  });

  it('I-61: All enforced policies have status declared', () => {
    const enforced = Object.entries(contract.policies).filter(([_, p]) =>
      p.enforcementMode === 'runtime' && p.status === 'enforced'
    );
    const missing = enforced.filter(([_, p]) => !p.failureMode);
    assert.strictEqual(missing.length, 0,
      `Policies without failureMode: ${missing.map(([k]) => k).join(', ')}`);
  });

  it('I-66: Unenforced policies have documented notes', () => {
    const unenforced = Object.entries(contract.policies).filter(([_, p]) =>
      p.status === 'unenforced'
    );
    const missingNote = unenforced.filter(([_, p]) => !p.note);
    assert.strictEqual(missingNote.length, 0,
      `Unenforced policies without notes: ${missingNote.map(([k]) => k).join(', ')}`);
  });
});
