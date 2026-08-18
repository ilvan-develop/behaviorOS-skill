#!/usr/bin/env node

/**
 * behaviorOS - ci-gate-check.mjs tests
 *
 * The declared gate (ci-gate.json) must not drift from the pipeline: every required check must
 * map to a step, or be legitimately skipped. These tests prove the checker can fail closed
 * (missing gate, missing workflow, missing required check) and can pass (all checks present,
 * or skipIfMissing with no script configured).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { packageScriptName, readWorkflowCommands, resolveCheckPresent } from '../scripts/ci-gate-check.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const CHECK = join(ROOT_DIR, 'scripts', 'ci-gate-check.mjs');

let FIXTURES;

const GATE = {
  version: '1.0.0',
  required: [
    { id: 'policy-validation', command: 'node scripts/validate.mjs' },
    { id: 'secret-scan', command: 'node scripts/lint.mjs --secrets-only' },
    { id: 'typecheck', command: 'pnpm typecheck', skipIfMissing: true },
    { id: 'lint', command: 'pnpm lint', skipIfMissing: true },
    { id: 'unit-tests', command: 'pnpm test', skipIfMissing: true },
    { id: 'build', command: 'pnpm build', skipIfMissing: true },
  ],
  failConditions: ['policy_failed', 'tests_failed', 'build_failed'],
};

const WORKFLOW = `name: CI
on: [push]
jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Policy validation
        run: node scripts/validate.mjs
      - name: Secret scan
        run: node scripts/lint.mjs --secrets-only
      - name: Lint
        run: node scripts/ci-run.mjs lint
      - name: Typecheck
        run: node scripts/ci-run.mjs typecheck
      - name: Tests
        run: node scripts/ci-run.mjs test
      - name: Build
        run: node scripts/ci-run.mjs build
`;

const SCRIPTS = {
  validate: 'node scripts/validate.mjs',
  lint: 'node scripts/lint.mjs',
  test: 'node --test "tests/**/*.test.js"',
  build: 'node build.mjs',
};

function fixture(name, { gate = GATE, scripts = SCRIPTS, workflow = WORKFLOW, noGate = false, noWorkflow = false } = {}) {
  const dir = join(FIXTURES, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, '.opencode', 'governance'), { recursive: true });
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
  if (!noGate) writeFileSync(join(dir, '.opencode', 'governance', 'ci-gate.json'), JSON.stringify(gate, null, 2));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', private: true, scripts }, null, 2));
  if (!noWorkflow) writeFileSync(join(dir, '.github', 'workflows', 'oage-ci.yml'), workflow);
  return dir;
}

function runCheck(cwd) {
  const result = spawnSync(process.execPath, [CHECK], { cwd, encoding: 'utf8' });
  return { code: result.status, out: `${result.stdout || ''}${result.stderr || ''}` };
}

before(() => {
  FIXTURES = join(tmpdir(), `oage-ci-gate-${process.pid}`);
  rmSync(FIXTURES, { recursive: true, force: true });
  mkdirSync(FIXTURES, { recursive: true });
});

after(() => {
  rmSync(FIXTURES, { recursive: true, force: true });
});

describe('helpers', () => {
  it('extracts the package script name from a pm command', () => {
    assert.equal(packageScriptName('pnpm lint'), 'lint');
    assert.equal(packageScriptName('npm run test:unit'), 'test:unit');
    assert.equal(packageScriptName('node scripts/validate.mjs'), null);
  });

  it('reads run: commands from a workflow, including block scalars', () => {
    const dir = fixture('helpers-workflow');
    const commands = readWorkflowCommands(join(dir, '.github', 'workflows', 'oage-ci.yml'));
    assert.ok(commands.includes('node scripts/validate.mjs'));
    assert.ok(commands.includes('node scripts/ci-run.mjs lint'));
    assert.equal(readWorkflowCommands(join(dir, 'nope.yml')), null);
  });

  it('returns "skipped" only when skipIfMissing and the script is absent', () => {
    const pkg = { scripts: { lint: 'eslint' } };
    assert.equal(resolveCheckPresent({ command: 'pnpm typecheck', skipIfMissing: true }, pkg, []), 'skipped');
    assert.equal(resolveCheckPresent({ command: 'pnpm lint', skipIfMissing: true }, pkg, []), false);
  });

  it('matches a script run through the fail-closed runner', () => {
    const pkg = { scripts: { lint: 'eslint', test: 'node --test' } };
    assert.equal(resolveCheckPresent({ command: 'pnpm lint' }, pkg, ['node scripts/ci-run.mjs lint']), true);
    assert.equal(resolveCheckPresent({ command: 'pnpm test' }, pkg, ['npm test']), true);
  });

  it('matches a direct node command exactly', () => {
    const commands = ['node scripts/validate.mjs', 'node scripts/lint.mjs --secrets-only'];
    assert.equal(resolveCheckPresent({ command: 'node scripts/validate.mjs' }, null, commands), true);
    assert.equal(resolveCheckPresent({ command: 'node scripts/lint.mjs --secrets-only' }, null, commands), true);
    assert.equal(resolveCheckPresent({ command: 'node scripts/lint.mjs' }, null, commands), false);
  });
});

describe('cli — a fully covered pipeline passes', () => {
  it('passes when every required check has a step or is legitimately skipped', () => {
    const dir = fixture('full-pass');
    const { code, out } = runCheck(dir);
    assert.equal(code, 0, `expected PASS, got: ${out}`);
    assert.match(out, /PASS policy-validation/);
    assert.match(out, /SKIP typecheck/);
    assert.match(out, /all 6 required checks present/);
  });
});

describe('cli — the checker can fail closed', () => {
  it('fails when a required check has no step and its script exists', () => {
    const workflow = WORKFLOW.replace('      - name: Lint\n        run: node scripts/ci-run.mjs lint\n', '');
    const dir = fixture('missing-lint', {
      workflow,
      scripts: { ...SCRIPTS, lint: 'eslint .' },
    });
    const { code, out } = runCheck(dir);
    assert.notEqual(code, 0, `expected FAIL, got: ${out}`);
    assert.match(out, /FAIL lint/);
  });

  it('fails when ci-gate.json is missing', () => {
    const dir = fixture('missing-gate', { noGate: true });
    const { code } = runCheck(dir);
    assert.notEqual(code, 0);
  });

  it('fails when no workflow exists to check', () => {
    const dir = fixture('missing-workflow', { noWorkflow: true });
    const { code } = runCheck(dir);
    assert.notEqual(code, 0);
  });

  it('fails when the gate declares no required checks', () => {
    const dir = fixture('no-required', { gate: { version: '1.0.0', required: [], failConditions: ['x'] } });
    const { code } = runCheck(dir);
    assert.notEqual(code, 0);
  });

  it('fails when the gate declares no failConditions', () => {
    const dir = fixture('no-failconditions', { gate: { version: '1.0.0', required: GATE.required } });
    const { code } = runCheck(dir);
    assert.notEqual(code, 0);
  });

  it('fails on a malformed required entry', () => {
    const gate = { version: '1.0.0', required: [{ id: 'broken' }], failConditions: ['x'] };
    const dir = fixture('malformed-entry', { gate });
    const { code } = runCheck(dir);
    assert.notEqual(code, 0);
  });
});
