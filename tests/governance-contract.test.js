#!/usr/bin/env node

/**
 * behaviorOS - Governance Contract (OAGE P1.0)
 *
 * The contract declares who has authority to apply each policy; the doctor confronts that
 * declaration with the codebase. These tests do two separate jobs:
 *
 *  1. Assert the SHIPPED contract is complete and truthful — no policy file without an entry,
 *     no entry claiming a consumer that does not read it, no runtime claim without a plugin.
 *  2. Prove the doctor actually detects each failure, by building throwaway projects that
 *     contain them. A doctor that cannot fail is the same trap as a CI that cannot fail: the
 *     audit found `validate.mjs` reporting 24/24 green while 11 of 29 policies had no consumer
 *     at all, because nothing was checking the thing that mattered.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, cpSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { diagnose, detectMode, referencesPolicy, findDuplicatePolicies } from '../scripts/governance-doctor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const DOCTOR = join(ROOT_DIR, 'scripts', 'governance-doctor.mjs');

let FIXTURES;

/**
 * Build a minimal project: a governance dir with the given policy files, a contract, and
 * optionally a plugin/script that references a policy.
 */
function fixture(name, { policies = {}, contract, files = {}, asRepo = false } = {}) {
  const dir = join(FIXTURES, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, '.opencode', 'governance'), { recursive: true });

  for (const [file, content] of Object.entries(policies)) {
    writeFileSync(join(dir, '.opencode', 'governance', file), JSON.stringify(content ?? {}, null, 2));
  }
  if (contract) {
    writeFileSync(
      join(dir, '.opencode', 'governance', 'governance-contract.json'),
      JSON.stringify(contract, null, 2),
    );
  }
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  if (asRepo) {
    // detectMode treats core/ + templates/base as "this is the behaviorOS repo".
    mkdirSync(join(dir, 'core'), { recursive: true });
    mkdirSync(join(dir, 'templates', 'base'), { recursive: true });
  }
  return dir;
}

const codes = (result) => result.findings.map((f) => `${f.level}:${f.code}`);
const codesFor = (result, policy) =>
  result.findings.filter((f) => f.policy === policy).map((f) => f.code);

before(() => {
  FIXTURES = join(tmpdir(), `oage-contract-${process.pid}`);
  rmSync(FIXTURES, { recursive: true, force: true });
  mkdirSync(FIXTURES, { recursive: true });
});

after(() => {
  rmSync(FIXTURES, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// The shipped contract
// ─────────────────────────────────────────────────────────────────────────────

describe('The shipped Governance Contract', () => {
  const contractPath = join(ROOT_DIR, 'templates', 'base', 'governance', 'governance-contract.json');

  it('exists in the distributable template, so it installs with every project', () => {
    assert.ok(existsSync(contractPath), 'templates/base/governance/governance-contract.json missing');
  });

  it('is byte-identical to this repo\'s own copy', () => {
    const shipped = readFileSync(contractPath, 'utf8');
    const own = readFileSync(join(ROOT_DIR, '.opencode', 'governance', 'governance-contract.json'), 'utf8');
    assert.equal(shipped, own, 'the contract must not drift between the template and this repo');
  });

  it('declares every policy with the full authority chain', () => {
    const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
    const REQUIRED = ['authority', 'enforcementMode', 'failureMode', 'status', 'consumers', 'adversarialTests'];

    for (const [policy, entry] of Object.entries(contract.policies)) {
      for (const field of REQUIRED) {
        assert.ok(field in entry, `${policy} is missing "${field}"`);
      }
      assert.ok(
        Object.keys(contract.authorities).includes(entry.authority),
        `${policy}: unknown authority "${entry.authority}"`,
      );
      assert.ok(
        Object.keys(contract.enforcementModes).includes(entry.enforcementMode),
        `${policy}: unknown enforcementMode "${entry.enforcementMode}"`,
      );
      assert.ok(
        Object.keys(contract.failureModes).includes(entry.failureMode),
        `${policy}: unknown failureMode "${entry.failureMode}"`,
      );
      assert.ok(['enforced', 'unenforced'].includes(entry.status), `${policy}: bad status`);
      if (entry.status === 'unenforced') {
        assert.ok(entry.note, `${policy}: an unenforced policy must explain the gap in "note"`);
      }
    }
  });

  it('leaves no policy file undeclared and no declaration false', () => {
    const result = diagnose(ROOT_DIR);
    const blockers = result.findings.filter((f) => f.level === 'BLOCKER');
    assert.deepEqual(
      blockers.map((b) => `${b.code} ${b.policy}`),
      [],
      'the doctor must report zero blockers for this repo',
    );
  });

  it('runs in authoring mode inside this repo', () => {
    assert.equal(detectMode(ROOT_DIR), 'authoring');
  });

  it('accounts for every policy file on disk', () => {
    const result = diagnose(ROOT_DIR);
    assert.ok(result.summary.policies >= 29, `expected >= 29 policies, got ${result.summary.policies}`);
    assert.equal(
      result.summary.enforced + result.summary.unenforced,
      result.summary.policies,
      'every policy must be either enforced or an explicitly tracked gap',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The doctor must be able to fail
// ─────────────────────────────────────────────────────────────────────────────

describe('FALSE_ENFORCEMENT — the audited failure shape', () => {
  it('blocks a policy declared enforced that nothing reads', () => {
    const dir = fixture('false-enforcement', {
      asRepo: true,
      policies: { 'ghost-gate.json': { enabled: true } },
      contract: {
        version: '1.0.0',
        authorities: { kernel: 'x' },
        enforcementModes: { runtime: 'x' },
        failureModes: { 'fail-closed': 'x' },
        policies: {
          'ghost-gate.json': {
            authority: 'kernel',
            enforcementMode: 'runtime',
            failureMode: 'fail-closed',
            status: 'enforced',
            consumers: [],
            adversarialTests: [],
          },
        },
      },
    });

    const found = codesFor(diagnose(dir), 'ghost-gate.json');
    assert.ok(found.includes('FALSE_ENFORCEMENT'), `expected FALSE_ENFORCEMENT, got ${found.join(', ')}`);
  });

  it('blocks a runtime claim that no plugin backs', () => {
    const dir = fixture('wrong-mode', {
      asRepo: true,
      policies: { 'phase-only.json': { enabled: true } },
      files: { 'scripts/some-check.mjs': "readFileSync('phase-only.json')\n" },
      contract: {
        version: '1.0.0',
        authorities: { kernel: 'x' },
        enforcementModes: { runtime: 'x' },
        failureModes: { 'fail-closed': 'x' },
        policies: {
          'phase-only.json': {
            authority: 'kernel',
            enforcementMode: 'runtime',
            failureMode: 'fail-closed',
            status: 'enforced',
            consumers: ['scripts/some-check.mjs'],
            adversarialTests: [],
          },
        },
      },
    });

    const found = codesFor(diagnose(dir), 'phase-only.json');
    assert.ok(found.includes('WRONG_MODE'), `expected WRONG_MODE, got ${found.join(', ')}`);
  });
});

describe('Drift between declaration and code', () => {
  const baseContract = (entry) => ({
    version: '1.0.0',
    authorities: { kernel: 'x' },
    enforcementModes: { runtime: 'x' },
    failureModes: { 'fail-closed': 'x' },
    policies: { 'thing.json': entry },
  });

  it('blocks a declared consumer that does not exist', () => {
    const dir = fixture('missing-consumer', {
      asRepo: true,
      policies: { 'thing.json': {} },
      contract: baseContract({
        authority: 'kernel',
        enforcementMode: 'runtime',
        failureMode: 'fail-closed',
        status: 'enforced',
        consumers: ['.opencode/plugins/gone.js'],
        adversarialTests: [],
      }),
    });
    assert.ok(codesFor(diagnose(dir), 'thing.json').includes('MISSING_CONSUMER'));
  });

  it('blocks a consumer that exists but stopped reading the policy', () => {
    const dir = fixture('stale-consumer', {
      asRepo: true,
      policies: { 'thing.json': {} },
      files: { '.opencode/plugins/enforce.js': '// refactored; no longer reads it\n' },
      contract: baseContract({
        authority: 'kernel',
        enforcementMode: 'runtime',
        failureMode: 'fail-closed',
        status: 'enforced',
        consumers: ['.opencode/plugins/enforce.js'],
        adversarialTests: [],
      }),
    });
    assert.ok(codesFor(diagnose(dir), 'thing.json').includes('STALE_CONSUMER'));
  });

  it('blocks a declared adversarial test that does not exist', () => {
    const dir = fixture('missing-test', {
      asRepo: true,
      policies: { 'thing.json': {} },
      files: { '.opencode/plugins/enforce.js': "load('thing.json')\n" },
      contract: baseContract({
        authority: 'kernel',
        enforcementMode: 'runtime',
        failureMode: 'fail-closed',
        status: 'enforced',
        consumers: ['.opencode/plugins/enforce.js'],
        adversarialTests: ['tests/nope.test.js'],
      }),
    });
    assert.ok(codesFor(diagnose(dir), 'thing.json').includes('MISSING_TEST'));
  });

  it('blocks a policy file with no contract entry', () => {
    const dir = fixture('undeclared', {
      asRepo: true,
      policies: { 'thing.json': {}, 'surprise.json': {} },
      files: { '.opencode/plugins/enforce.js': "load('thing.json')\n" },
      contract: baseContract({
        authority: 'kernel',
        enforcementMode: 'runtime',
        failureMode: 'fail-closed',
        status: 'enforced',
        consumers: ['.opencode/plugins/enforce.js'],
        adversarialTests: [],
      }),
    });
    assert.ok(codesFor(diagnose(dir), 'surprise.json').includes('UNDECLARED_POLICY'));
  });

  it('blocks when the contract itself is absent', () => {
    const dir = fixture('no-contract', { asRepo: true, policies: { 'thing.json': {} } });
    assert.ok(codes(diagnose(dir)).includes('BLOCKER:MISSING_CONTRACT'));
  });
});

describe('UNENFORCED_POLICY — a tracked gap warns, it does not block', () => {
  it('warns without blocking when the gap is declared honestly', () => {
    const dir = fixture('tracked-gap', {
      asRepo: true,
      policies: { 'aspiration.json': {} },
      contract: {
        version: '1.0.0',
        authorities: { ci: 'x' },
        enforcementModes: { ci: 'x' },
        failureModes: { 'fail-closed': 'x' },
        policies: {
          'aspiration.json': {
            authority: 'ci',
            enforcementMode: 'ci',
            failureMode: 'fail-closed',
            status: 'unenforced',
            consumers: [],
            adversarialTests: [],
            note: 'No consumer yet.',
          },
        },
      },
    });

    const result = diagnose(dir);
    assert.equal(result.summary.blockers, 0, 'an honest gap must not block');
    assert.ok(codesFor(result, 'aspiration.json').includes('UNENFORCED_POLICY'));
  });

  it('--strict turns tracked gaps into a failure', () => {
    // The real repo has tracked gaps today, so it is the natural subject.
    const lenient = spawnSync(process.execPath, [DOCTOR], { cwd: ROOT_DIR, encoding: 'utf8' });
    const strict = spawnSync(process.execPath, [DOCTOR, '--strict'], { cwd: ROOT_DIR, encoding: 'utf8' });

    assert.equal(lenient.status, 0, `default run must pass: ${lenient.stdout}`);
    assert.notEqual(strict.status, 0, '--strict must fail while gaps remain');
  });
});

describe('Report mode — the contract stays valid in an installed project', () => {
  it('does not blame an installed project for toolchain files it never receives', () => {
    const dir = fixture('installed', {
      asRepo: false, // no core/, no templates/ — exactly what a consumer project looks like
      policies: { 'thing.json': {} },
      contract: {
        version: '1.0.0',
        authorities: { declarative: 'x' },
        enforcementModes: { declarative: 'x' },
        failureModes: { none: 'x' },
        policies: {
          'thing.json': {
            authority: 'declarative',
            enforcementMode: 'declarative',
            failureMode: 'none',
            status: 'enforced',
            consumers: ['core/generator.mjs'],
            adversarialTests: [],
          },
        },
      },
    });

    const result = diagnose(dir);
    assert.equal(detectMode(dir), 'report');
    assert.equal(result.summary.blockers, 0, `installed project must not self-block: ${JSON.stringify(result.findings)}`);
  });

  it('a real fresh install passes its own doctor', () => {
    const dir = join(FIXTURES, 'real-install');
    mkdirSync(dir, { recursive: true });

    const install = spawnSync(
      process.execPath,
      [join(ROOT_DIR, 'scripts', 'install.mjs'), '--template=fintech'],
      { cwd: dir, encoding: 'utf8', env: { ...process.env, PROJECT_NAME: 'doctor-test', PROJECT_DESCRIPTION: 'x' } },
    );
    assert.equal(install.status, 0, install.stderr || install.stdout);

    assert.ok(
      existsSync(join(dir, '.opencode', 'governance', 'governance-contract.json')),
      'the contract must be installed into the project',
    );

    const doctor = spawnSync(process.execPath, [join(dir, 'scripts', 'governance-doctor.mjs')], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.equal(doctor.status, 0, `installed project failed its doctor:\n${doctor.stdout}${doctor.stderr}`);
    assert.match(doctor.stdout, /mode: report/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The mechanism
// ─────────────────────────────────────────────────────────────────────────────

describe('referencesPolicy — boundary matching', () => {
  it('does not mistake the audit log for the audit config', () => {
    // The bug this exists for: `audit.jsonl` contains `audit.json`, which credited oage-lib.js
    // as a consumer of a config it never reads, hiding the fact that retention never runs.
    assert.equal(referencesPolicy("appendFileSync('.opencode/audit/audit.jsonl', line)", 'audit.json'), false);
    assert.equal(referencesPolicy("loadGovernanceJSON(root, 'audit.json')", 'audit.json'), true);
  });

  it('matches a policy named as a bare filename or inside a path', () => {
    assert.equal(referencesPolicy("load('truth-gate.json')", 'truth-gate.json'), true);
    assert.equal(referencesPolicy('.opencode/governance/truth-gate.json', 'truth-gate.json'), true);
  });

  it('does not match a longer policy name that merely starts the same', () => {
    assert.equal(referencesPolicy("load('skill-gate-auto.json')", 'skill-gate.json'), false);
  });
});

describe('The doctor has a consumer (otherwise the contract is itself an unenforced policy)', () => {
  const WORKFLOWS = [
    ['own', join(ROOT_DIR, '.github', 'workflows', 'oage-ci.yml')],
    ['installed', join(ROOT_DIR, 'templates', 'base', 'ci', 'oage-ci.yml')],
  ];

  for (const [label, workflow] of WORKFLOWS) {
    it(`${label} workflow runs governance-doctor.mjs`, () => {
      const yaml = readFileSync(workflow, 'utf8');
      assert.match(yaml, /governance-doctor\.mjs/, 'CI must verify the contract, not just validate JSON shape');
    });
  }

  it('package.json exposes it as npm run doctor', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf8'));
    assert.match(pkg.scripts.doctor || '', /governance-doctor\.mjs/);
  });

  it('the generator ships it, so an installed project can run its own doctor', () => {
    const generator = readFileSync(join(ROOT_DIR, 'core', 'generator.mjs'), 'utf8');
    assert.match(generator, /'governance-doctor\.mjs'/);
  });

  it('the kernel protects the contract from being rewritten', () => {
    const policy = JSON.parse(
      readFileSync(join(ROOT_DIR, 'templates', 'base', 'governance', 'protected-resources.json'), 'utf8'),
    );
    const root = process.platform === 'win32' ? 'C:\repo' : '/repo';
    // Imported lazily: this assertion is about the kernel, not the contract tooling.
    return import('../.opencode/plugins/lib/oage-lib.js').then(({ matchesAny }) => {
      assert.ok(
        matchesAny('.opencode/governance/governance-contract.json', policy.denyWritePatterns, root),
        'the authority map must not be writable by the agent it governs',
      );
    });
  });
});

describe('DUPLICATE_POLICY — the contract is a manifest, not a pile', () => {
  it('detects a policy declared twice in the raw text', () => {
    const real = readFileSync(
      join(ROOT_DIR, '.opencode', 'governance', 'governance-contract.json'),
      'utf8',
    );
    assert.deepEqual(findDuplicatePolicies(real), [], 'the shipped contract must have no duplicates');

    // Inject a second, weaker declaration of a policy that is already declared.
    const stealth = [
      '    "truth-gate.json": {',
      '      "authority": "kernel", "enforcementMode": "runtime", "failureMode": "fail-closed",',
      '      "status": "unenforced", "consumers": [], "adversarialTests": [], "note": "shadow copy"',
      '    },',
      '    "risk-engine.json": {',
    ].join('\n');
    const tampered = real.replace('    "risk-engine.json": {', stealth);

    assert.deepEqual(findDuplicatePolicies(tampered), [{ policy: 'truth-gate.json', count: 2 }]);
  });

  it('blocks on a duplicate, because JSON.parse silently keeps only one', () => {
    const contract = {
      version: '1.0.0',
      authorities: { kernel: 'x' },
      enforcementModes: { runtime: 'x' },
      failureModes: { 'fail-closed': 'x' },
      policies: {},
    };
    const dir = fixture('duplicate-policy', {
      asRepo: true,
      policies: { 'thing.json': {} },
      files: { '.opencode/plugins/enforce.js': "load('thing.json')\n" },
    });

    // Written by hand: JSON.stringify cannot produce a duplicate key, which is the whole point.
    const entry = (status) => `    "thing.json": {
      "authority": "kernel", "enforcementMode": "runtime", "failureMode": "fail-closed",
      "status": "${status}", "consumers": [".opencode/plugins/enforce.js"], "adversarialTests": [], "note": "n"
    }`;
    const raw = `{
  "version": "1.0.0",
  "authorities": ${JSON.stringify(contract.authorities)},
  "enforcementModes": ${JSON.stringify(contract.enforcementModes)},
  "failureModes": ${JSON.stringify(contract.failureModes)},
  "policies": {
${entry('unenforced')},
${entry('enforced')}
  }
}`;
    writeFileSync(join(dir, '.opencode', 'governance', 'governance-contract.json'), raw);

    const result = diagnose(dir);
    assert.ok(codesFor(result, 'thing.json').includes('DUPLICATE_POLICY'));
    assert.ok(result.summary.blockers > 0, 'a duplicate declaration must block');
  });
});

describe('The enforcement invariant is frozen where it can be found', () => {
  const STATEMENT_EN = 'A policy file is not an enforcement mechanism';

  for (const copy of [
    join(ROOT_DIR, 'templates', 'base', 'governance', 'behavior-contract.json'),
    join(ROOT_DIR, '.opencode', 'governance', 'behavior-contract.json'),
  ]) {
    it(`${copy.includes('templates') ? 'shipped' : 'own'} behavior-contract.json carries it`, () => {
      const contract = JSON.parse(readFileSync(copy, 'utf8'));
      const inv = contract.enforcementInvariant;
      assert.ok(inv, 'enforcementInvariant missing');
      assert.match(inv.statementEn, /not an enforcement mechanism/);
      assert.deepEqual(inv.chain, ['policy', 'authority', 'consumer', 'enforcement', 'adversarialTest', 'ci']);
      assert.ok(existsSync(join(ROOT_DIR, inv.verifiedBy)), `verifiedBy must exist: ${inv.verifiedBy}`);
    });
  }

  it('the README states it, and no longer claims the permission matrix is enforced at runtime', () => {
    const readme = readFileSync(join(ROOT_DIR, 'README.md'), 'utf8');
    assert.ok(readme.includes(STATEMENT_EN), 'README must carry the invariant verbatim');
    assert.match(readme, /Permission matrix.*handoff \/ phase boundaries/s);
  });

  it('the doctor documents why the two modes exist', () => {
    const doctor = readFileSync(join(ROOT_DIR, 'scripts', 'governance-doctor.mjs'), 'utf8');
    assert.match(doctor, /AUTHORING MODE validates the implementation of behaviorOS itself/);
    assert.match(doctor, /REPORT MODE validates the governance contract as applicable to an installed consumer/);
  });
});
