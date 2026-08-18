#!/usr/bin/env node

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, copyFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { OageEnforce } from '../.opencode/plugins/oage-enforce.js';
import { appendAudit } from '../.opencode/plugins/lib/oage-lib.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const POWERSHELL = spawnSync('powershell', ['-NoProfile', '-Command', 'exit 0']).status === 0
  ? 'powershell'
  : spawnSync('pwsh', ['-NoProfile', '-Command', 'exit 0']).status === 0
    ? 'pwsh'
    : null;

function newFixture(prefix) {
  const dir = join(tmpdir(), `${prefix}-${process.pid}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, '.opencode', 'governance'), { recursive: true });
  return dir;
}

function copyGovernance(src, dst) {
  for (const f of readdirSync(src)) {
    copyFileSync(join(src, f), join(dst, f));
  }
}

function sourceOf(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function runGuard(script, args, cwd) {
  const result = spawnSync(POWERSHELL, [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(ROOT, script), ...args,
  ], { cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

async function makeHook(fixture) {
  const plugin = await OageEnforce({ directory: fixture });
  return plugin['tool.execute.before'];
}

async function attempt(hook, args, { sessionID = 'ses-fail-closed' } = {}) {
  try {
    await hook({ tool: 'write', sessionID, callID: 'call-1' }, { args });
    return null;
  } catch (error) {
    return error;
  }
}

function auditEvents(fixture) {
  const file = join(fixture, '.opencode', 'audit', 'audit.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// ─────────────────────────────────────────────────────────────────────────────
// permissions-matrix.json — fail-closed phase gate (consumer: permission-guard.ps1)
// ─────────────────────────────────────────────────────────────────────────────

describe('permissions-matrix.json — phase gate is consumed and blocks', { skip: POWERSHELL === null }, () => {
  let fixture;

  before(() => {
    fixture = newFixture('oage-perm');
    copyFileSync(
      join(ROOT, '.opencode', 'governance', 'permissions-matrix.json'),
      join(fixture, '.opencode', 'governance', 'permissions-matrix.json'),
    );
  });

  after(() => {
    rmSync(fixture, { recursive: true, force: true });
  });

  it('consumer (permission-guard.ps1) reads the policy — not dead code', () => {
    assert.ok(sourceOf('scripts/guards/permission-guard.ps1').includes('permissions-matrix.json'));
  });

  it('BLOCKS an agent that is not in the phase allowedAgents list', () => {
    const { status, stdout } = runGuard('scripts/guards/permission-guard.ps1', ['-Agent', 'frontend', '-Phase', 'F1'], fixture);
    assert.notEqual(status, 0, `expected DENY, got ${stdout}`);
    assert.match(stdout, /\[BLOCKED\]/);
  });

  it('BLOCKS an allowed agent in a phase that requires approval', () => {
    const { status, stdout } = runGuard('scripts/guards/permission-guard.ps1', ['-Agent', 'backend', '-Phase', 'F2'], fixture);
    assert.notEqual(status, 0, `F2 requires approval, expected DENY, got ${stdout}`);
    assert.match(stdout, /aprovacao/);
  });

  it('BLOCKS a security agent in F0 (security is only allowed from F2 on)', () => {
    const { status, stdout } = runGuard('scripts/guards/permission-guard.ps1', ['-Agent', 'security', '-Phase', 'F0'], fixture);
    assert.notEqual(status, 0, `expected DENY, got ${stdout}`);
  });

  it('ALLOWS an allowed agent in a phase with no approval requirement', () => {
    const { status, stdout } = runGuard('scripts/guards/permission-guard.ps1', ['-Agent', 'backend', '-Phase', 'F1'], fixture);
    assert.equal(status, 0, `expected PASS, got ${stdout}`);
  });

  it('ALLOWS orchestrator in F0 (listed in F0 allowedAgents)', () => {
    const { status, stdout } = runGuard('scripts/guards/permission-guard.ps1', ['-Agent', 'orchestrator', '-Phase', 'F0'], fixture);
    assert.equal(status, 0, `expected PASS, got ${stdout}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tool-gate.json — fail-closed runtime gate (consumers: oage-enforce.js, tool-guard.ps1)
// ─────────────────────────────────────────────────────────────────────────────

describe('tool-gate.json — rules are consumed and block', { skip: POWERSHELL === null }, () => {
  let fixture;

  before(() => {
    fixture = newFixture('oage-tool');
    copyFileSync(
      join(ROOT, '.opencode', 'governance', 'tool-gate.json'),
      join(fixture, '.opencode', 'governance', 'tool-gate.json'),
    );
  });

  after(() => {
    rmSync(fixture, { recursive: true, force: true });
  });

  it('consumers read the policy — not dead code', () => {
    assert.ok(sourceOf('.opencode/plugins/oage-enforce.js').includes('tool-gate.json'));
    assert.ok(sourceOf('scripts/guards/tool-guard.ps1').includes('tool-gate.json'));
  });

  it('BLOCKS a destructive command (rm -rf → deny rule)', () => {
    const { status, stdout } = runGuard('scripts/guards/tool-guard.ps1', ['-Tool', 'bash', '-File', '', '-Command', 'rm -rf node_modules'], fixture);
    assert.notEqual(status, 0, `expected DENY, got ${stdout}`);
    assert.match(stdout, /\[BLOCKED\]/);
  });

  it('BLOCKS a git push (ask rule refuses without approval)', () => {
    const { status, stdout } = runGuard('scripts/guards/tool-guard.ps1', ['-Tool', 'bash', '-File', '', '-Command', 'git push origin main'], fixture);
    assert.notEqual(status, 0, `expected block on git push, got ${stdout}`);
  });

  it('BLOCKS a git commit (block rule with required checks)', () => {
    const { status, stdout } = runGuard('scripts/guards/tool-guard.ps1', ['-Tool', 'bash', '-File', '', '-Command', 'git commit -m "wip"'], fixture);
    assert.notEqual(status, 0, `expected block on git commit, got ${stdout}`);
    assert.match(stdout, /git-commit/);
  });

  it('BLOCKS a prisma schema write (ask rule refuses without approval)', () => {
    const { status, stdout } = runGuard('scripts/guards/tool-guard.ps1', ['-Tool', 'write', '-File', 'packages/db/schema.prisma'], fixture);
    assert.notEqual(status, 0, `expected block on *.prisma write, got ${stdout}`);
  });

  it('ALLOWS a write that matches no restrictive rule', () => {
    const { status, stdout } = runGuard('scripts/guards/tool-guard.ps1', ['-Tool', 'write', '-File', 'src/index.ts'], fixture);
    assert.equal(status, 0, `expected PASS, got ${stdout}`);
  });

  it('ALLOWS a non-restrictive bash command', () => {
    const { status, stdout } = runGuard('scripts/guards/tool-guard.ps1', ['-Tool', 'bash', '-File', '', '-Command', 'git status'], fixture);
    assert.equal(status, 0, `expected PASS, got ${stdout}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// version-pinning-gate.json — fail-closed runtime gate (consumer: oage-enforce.js)
// ─────────────────────────────────────────────────────────────────────────────

describe('version-pinning-gate.json — content validation blocks', () => {
  let fixture;
  let hook;

  before(async () => {
    fixture = newFixture('oage-vpin');
    copyGovernance(join(ROOT, '.opencode', 'governance'), join(fixture, '.opencode', 'governance'));
    mkdirSync(join(fixture, 'src'), { recursive: true });
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({ dependencies: { prisma: '^7.6.0' } }));
    hook = await makeHook(fixture);
  });

  after(() => {
    rmSync(fixture, { recursive: true, force: true });
  });

  beforeEach(() => {
    rmSync(join(fixture, '.opencode', 'audit'), { recursive: true, force: true });
  });

  it('consumer (oage-enforce.js) reads the policy — not dead code', () => {
    assert.ok(sourceOf('.opencode/plugins/oage-enforce.js').includes('version-pinning-gate.json'));
  });

  it('BLOCKS writing package.json without a prior version_verified check (requirePackageJsonCheck)', async () => {
    const error = await attempt(hook, { filePath: 'package.json', content: JSON.stringify({ dependencies: { prisma: '^7.6.0' } }) });
    assert.ok(error, 'expected DENY, but the write was ALLOWED');
    assert.match(error.message, /Verifique a versão atual/);
  });

  it('BLOCKS a pinned-major violation even after a verified read (fail-closed content check)', async () => {
    appendAudit(fixture, { event: 'version_verified', target: 'package.json', sessionID: 'ses-fail-closed' });
    const error = await attempt(hook, { filePath: 'package.json', content: JSON.stringify({ dependencies: { prisma: '^6.0.0' } }) });
    assert.ok(error, 'expected DENY, but the write was ALLOWED');
    assert.match(error.message, /Versão incorreta/);
  });

  it('ALLOWS the pinned version after a verified read (no over-blocking)', async () => {
    appendAudit(fixture, { event: 'version_verified', target: 'package.json', sessionID: 'ses-fail-closed' });
    const error = await attempt(hook, { filePath: 'package.json', content: JSON.stringify({ dependencies: { prisma: '^7.6.0' } }) });
    assert.equal(error, null, `expected ALLOW, got: ${error?.message}`);
  });

  it('ALLOWS writes to files that are not the configured manifest (no over-blocking)', async () => {
    const error = await attempt(hook, { filePath: 'src/util.ts', content: 'export const x = 1;\n' });
    assert.equal(error, null, `expected ALLOW, got: ${error?.message}`);
  });

  it('records the denial in the audit trail (version_pinning_warn / version_mismatch)', async () => {
    await attempt(hook, { filePath: 'package.json', content: JSON.stringify({ dependencies: { prisma: '^7.6.0' } }) });
    const events = auditEvents(fixture).map((e) => e.event);
    assert.ok(events.includes('version_pinning_warn'), `expected version_pinning_warn, got ${events.join(', ')}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// version-registry.json — fail-closed runtime gate (consumer: oage-enforce.js)
// ─────────────────────────────────────────────────────────────────────────────

describe('version-registry.json — registry is the decision source', () => {
  let fixture;
  let hook;
  let registry;

  before(async () => {
    fixture = newFixture('oage-registry');
    copyGovernance(join(ROOT, '.opencode', 'governance'), join(fixture, '.opencode', 'governance'));
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({ dependencies: { prisma: '^7.6.0' } }));
    registry = JSON.parse(readFileSync(join(ROOT, '.opencode', 'governance', 'version-registry.json'), 'utf8'));
    hook = await makeHook(fixture);
  });

  after(() => {
    rmSync(fixture, { recursive: true, force: true });
  });

  beforeEach(() => {
    rmSync(join(fixture, '.opencode', 'audit'), { recursive: true, force: true });
  });

  it('consumer (oage-enforce.js) reads the registry — not dead code', () => {
    assert.ok(sourceOf('.opencode/plugins/oage-enforce.js').includes('version-registry.json'));
  });

  it('the mismatch block message encodes the registry currentMajor (registry drives the gate)', async () => {
    appendAudit(fixture, { event: 'version_verified', target: 'package.json', sessionID: 'ses-fail-closed' });
    const error = await attempt(hook, { filePath: 'package.json', content: JSON.stringify({ dependencies: { prisma: '^6.0.0' } }) });
    assert.ok(error, 'expected DENY, but the write was ALLOWED');
    assert.ok(
      error.message.includes(`esperado ^${registry.libraries.prisma.currentMajor}.0.0`),
      `message must carry the registry version, got: ${error.message}`,
    );
  });

  it('ALLOWS every registry-declared dependency written at its pinned major in one manifest', async () => {
    appendAudit(fixture, { event: 'version_verified', target: 'package.json', sessionID: 'ses-fail-closed' });
    const deps = {};
    for (const [lib, entry] of Object.entries(registry.libraries)) {
      deps[lib] = `^${entry.currentMajor}.0.0`;
    }
    const error = await attempt(hook, { filePath: 'package.json', content: JSON.stringify({ dependencies: deps }) });
    assert.equal(error, null, `expected ALLOW for all pinned majors, got: ${error?.message}`);
  });

  it('BLOCKS when any dependency drifts from the registry, and records version_mismatch', async () => {
    appendAudit(fixture, { event: 'version_verified', target: 'package.json', sessionID: 'ses-fail-closed' });
    const content = JSON.stringify({ dependencies: { next: '^15.0.0', react: '^19.0.0' } });
    const error = await attempt(hook, { filePath: 'package.json', content });
    assert.ok(error, 'expected DENY for next@15 (registry pins 16), but the write was ALLOWED');
    assert.match(error.message, /next=\^15\.0\.0 \(esperado \^16\.0\.0\)/);
    const events = auditEvents(fixture).map((e) => e.event);
    assert.ok(events.includes('version_mismatch'), `expected version_mismatch, got ${events.join(', ')}`);
  });
});
