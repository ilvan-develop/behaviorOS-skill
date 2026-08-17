#!/usr/bin/env node

/**
 * behaviorOS - CI must be able to fail
 *
 * OAGE §34-36/§60 make CI the final authority. An authority that cannot return a negative
 * verdict is decoration, and the audited workflow could not: every quality step ended in
 * `|| echo "No X script configured, skipping"`, which treats "script absent" and "script
 * failed" identically because both are non-zero exits.
 *
 * These tests inject failure and assert it propagates. The last one is a regression fence on
 * the YAML itself, so the swallow pattern cannot come back through a copy-paste.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { scriptStatus, detectPackageManager } from '../scripts/ci-run.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const CI_RUN = join(ROOT_DIR, 'scripts', 'ci-run.mjs');

let FIXTURES;

/** Build a throwaway project with the given package.json scripts. */
function project(name, scripts, extraFiles = {}) {
  const dir = join(FIXTURES, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name, version: '1.0.0', private: true, scripts }, null, 2),
  );
  for (const [file, content] of Object.entries(extraFiles)) {
    writeFileSync(join(dir, file), content);
  }
  return dir;
}

/** Run scripts/ci-run.mjs inside `cwd`. */
function ciRun(cwd, scriptName) {
  const result = spawnSync(process.execPath, [CI_RUN, scriptName], {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  return { code: result.status, out: `${result.stdout || ''}${result.stderr || ''}` };
}

before(() => {
  FIXTURES = join(tmpdir(), `oage-ci-failclosed-${process.pid}`);
  rmSync(FIXTURES, { recursive: true, force: true });
  mkdirSync(FIXTURES, { recursive: true });
});

after(() => {
  rmSync(FIXTURES, { recursive: true, force: true });
});

describe('Failure injection — a failing script must fail the step', () => {
  it('propagates a non-zero exit from the project script', () => {
    const dir = project(
      'failing',
      { test: 'node fail.mjs' },
      { 'fail.mjs': 'console.error("2 tests failed");\nprocess.exit(1);\n' },
    );
    const { code, out } = ciRun(dir, 'test');
    assert.notEqual(code, 0, `a failing test script must fail the step (output: ${out})`);
    assert.match(out, /FAIL test/, 'the failure must be stated, not hidden');
  });

  it('propagates a high exit code rather than normalizing it', () => {
    const dir = project(
      'failing-7',
      { build: 'node fail7.mjs' },
      { 'fail7.mjs': 'process.exit(7);\n' },
    );
    const { code } = ciRun(dir, 'build');
    assert.notEqual(code, 0);
  });

  it('does not confuse a failing script with an absent one', () => {
    const dir = project(
      'failing-msg',
      { lint: 'node bad.mjs' },
      { 'bad.mjs': 'process.exit(1);\n' },
    );
    const { out } = ciRun(dir, 'lint');
    assert.doesNotMatch(out, /SKIP/, 'a failing script must never be reported as skipped');
  });
});

describe('Absence — only a genuinely unconfigured script may pass', () => {
  it('skips with exit 0 when the script is not configured', () => {
    const dir = project('no-typecheck', { test: 'node -v' });
    const { code, out } = ciRun(dir, 'typecheck');
    assert.equal(code, 0);
    assert.match(out, /SKIP typecheck/);
  });

  it('skips when there is no package.json at all', () => {
    const dir = join(FIXTURES, 'empty');
    mkdirSync(dir, { recursive: true });
    const { code, out } = ciRun(dir, 'lint');
    assert.equal(code, 0);
    assert.match(out, /no package\.json/);
  });

  it('fails — does not skip — on a malformed package.json', () => {
    const dir = join(FIXTURES, 'malformed');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), '{ this is not json');
    const { code, out } = ciRun(dir, 'lint');
    assert.notEqual(code, 0, 'an unreadable manifest is a failure, not an absence');
    assert.match(out, /FAIL/);
  });

  it('treats an empty script string as unconfigured', () => {
    const dir = project('blank', { lint: '   ' });
    assert.equal(scriptStatus('lint', dir).configured, false);
  });

  it('passes a script that succeeds', () => {
    const dir = project('passing', { test: 'node -v' });
    const { code, out } = ciRun(dir, 'test');
    assert.equal(code, 0, out);
    assert.match(out, /PASS test/);
  });
});

describe('Package manager detection', () => {
  it('defaults to npm', () => {
    const dir = project('pm-npm', {});
    assert.equal(detectPackageManager(dir), 'npm');
  });

  it('prefers pnpm when a pnpm lockfile is present', () => {
    const dir = project('pm-pnpm', {}, { 'pnpm-lock.yaml': 'lockfileVersion: 9\n' });
    assert.equal(detectPackageManager(dir), 'pnpm');
  });

  it('uses yarn when a yarn lockfile is present', () => {
    const dir = project('pm-yarn', {}, { 'yarn.lock': '# yarn\n' });
    assert.equal(detectPackageManager(dir), 'yarn');
  });
});

describe('Regression fence on the workflow YAML', () => {
  const WORKFLOWS = [
    join(ROOT_DIR, '.github', 'workflows', 'oage-ci.yml'),
    join(ROOT_DIR, 'templates', 'base', 'ci', 'oage-ci.yml'),
  ];

  for (const workflow of WORKFLOWS) {
    it(`${workflow.includes('templates') ? 'installed' : 'own'} workflow never swallows a failure`, () => {
      const yaml = readFileSync(workflow, 'utf8');
      // The exact shape that made CI unfailable: a command chained to `|| echo …skipping`.
      const swallow = /\|\|\s*echo\s+["'][^"']*skip/i;
      assert.doesNotMatch(yaml, swallow, 'a step must not report success when the command failed');
      assert.doesNotMatch(yaml, /2>\s*\/dev\/null\s*\|\|/, 'do not hide the reason a step failed');
    });

    it(`${workflow.includes('templates') ? 'installed' : 'own'} workflow has an explicit final gate`, () => {
      const yaml = readFileSync(workflow, 'utf8');
      assert.match(yaml, /final-gate:/, 'the aggregate verdict must be explicit');
      assert.match(yaml, /exit 1/, 'the final gate must be able to fail');
    });
  }

  it('the installed workflow routes quality steps through the fail-closed runner', () => {
    const yaml = readFileSync(join(ROOT_DIR, 'templates', 'base', 'ci', 'oage-ci.yml'), 'utf8');
    for (const step of ['lint', 'typecheck', 'test', 'build']) {
      assert.match(yaml, new RegExp(`ci-run\\.mjs ${step}\\b`), `${step} must use ci-run.mjs`);
    }
  });
});
