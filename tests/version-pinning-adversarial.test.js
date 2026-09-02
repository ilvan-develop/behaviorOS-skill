#!/usr/bin/env node

/**
 * behaviorOS - Version pinning adversarial tests (OAGE §19)
 *
 * Covers version-pinning-gate.json and version-registry.json together: the gate is the
 * consumer-side contract and the registry is the source of truth it validates against. Both
 * are read by .opencode/plugins/oage-enforce.js (loadGovernanceJSON 'version-pinning-gate.json'
 * / 'version-registry.json') inside evaluateFileWrite, which runs for write/edit AND for file
 * writes embedded in bash (heredoc/redirection) — so the bypass route a model actually tried
 * is attacked here too.
 *
 * These drive the REAL tool.execute.before hook against a throwaway project seeded with the
 * shipped templates/base/governance policy, and assert the exact three things the doctor's
 * UNTESTED_POLICY warning claimed nobody had proven: the policy is consumed (not dead code),
 * a violating call is blocked (fail-closed), and a legitimate call passes (no over-block).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, cpSync } from 'fs';
import { tmpdir } from 'os';
import { OageEnforce } from '../.opencode/plugins/oage-enforce.js';
import { appendAudit } from '../.opencode/plugins/lib/oage-lib.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

let FIXTURE;
let hook;
let callSeq = 0;

/** package.json shaped content assembled at runtime so no literal ever looks like a secret. */
function pkg(deps) {
  return JSON.stringify({ name: 'fixture', version: '1.0.0', dependencies: deps });
}

/** Drive the real tool.execute.before hook. Returns the thrown Error or null. */
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
  FIXTURE = join(tmpdir(), `oage-version-pinning-${process.pid}`);
  rmSync(FIXTURE, { recursive: true, force: true });
  mkdirSync(join(FIXTURE, '.opencode', 'governance'), { recursive: true });
  mkdirSync(join(FIXTURE, 'config'), { recursive: true });

  cpSync(join(ROOT_DIR, 'templates', 'base', 'governance'), join(FIXTURE, '.opencode', 'governance'), { recursive: true });
  writeFileSync(join(FIXTURE, '.opencode', 'governance', 'state-machine.json'), JSON.stringify({ currentState: 'F0' }));

  const plugin = await OageEnforce({ directory: FIXTURE });
  hook = plugin['tool.execute.before'];
});

after(() => {
  rmSync(FIXTURE, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// version-registry.json is the source of truth: wrong major must block
// ─────────────────────────────────────────────────────────────────────────────

describe('version-pinning-gate.json + version-registry.json — content validation', () => {
  it('blocks writing package.json with a dependency major outside the registry (fail-closed)', async () => {
    const error = await attempt('write', { filePath: 'package.json', content: pkg({ prisma: '^6.0.0' }) }, 'vp-wrong');
    assert.ok(error, 'expected the version-mismatch gate to throw');
    assert.match(error.message, /Versão incorreta/);
    assert.match(error.message, /prisma=.*\^6\.0\.0/);

    const mismatch = auditEvents().filter((e) => e.event === 'version_mismatch' && e.gate === 'version-pinning');
    assert.ok(mismatch.length > 0, 'a version_mismatch event must be recorded');
  });

  it('allows writing package.json with a version matching the registry (no over-block)', async () => {
    const error = await attempt(
      'write',
      { filePath: 'package.json', content: pkg({ prisma: '^7.6.0', 'better-auth': '^1.6.23', next: '^16.0.0' }) },
      'vp-ok',
    );
    assert.equal(error, null, `correct versions must pass, got: ${error?.message}`);
  });

  it('allows writing a dependency that is not in the registry at all', async () => {
    const error = await attempt(
      'write',
      { filePath: 'package.json', content: pkg({ 'some-unknown-lib': '^9.0.0' }) },
      'vp-unknown',
    );
    assert.equal(error, null, `unregistered libs must not be blocked, got: ${error?.message}`);
  });

  it('does not gate a file that is not the configured manifest (package.json only)', async () => {
    const error = await attempt(
      'write',
      { filePath: 'config/versions.json', content: pkg({ prisma: '^6.0.0' }) },
      'vp-not-pkg',
    );
    assert.equal(error, null, `non-manifest JSON must pass, got: ${error?.message}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The bash bypass route: a heredoc write must hit the same gate
// ─────────────────────────────────────────────────────────────────────────────

describe('version-pinning-gate.json — bash heredoc bypass', () => {
  it('blocks a bash heredoc write of package.json with the wrong major', async () => {
    const command = `cat > package.json <<EOF\n${pkg({ prisma: '^6.0.0' })}\nEOF`;
    const error = await attempt('bash', { command }, 'vp-heredoc');
    assert.ok(error, 'expected the heredoc write to be blocked');
    assert.match(error.message, /Versão incorreta/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requirePackageJsonCheck: editing an existing manifest needs a version_verified
// audit event first; and even then, the written version must still match.
// ─────────────────────────────────────────────────────────────────────────────

describe('version-pinning-gate.json — requirePackageJsonCheck', () => {
  it('blocks editing an existing package.json when no version was verified first', async () => {
    writeFileSync(join(FIXTURE, 'package.json'), pkg({ prisma: '^7.6.0' }));

    const error = await attempt(
      'edit',
      { filePath: 'package.json', oldString: '{}', newString: pkg({ prisma: '^7.6.0' }) },
      'vp-noverify',
    );
    assert.ok(error, 'editing a manifest without a version_verified event must be blocked');
    assert.match(error.message, /Verifique a versão atual/);
  });

  it('still blocks the wrong major even after the version was verified', async () => {
    writeFileSync(join(FIXTURE, 'package.json'), pkg({ prisma: '^7.6.0' }));
    appendAudit(FIXTURE, { event: 'version_verified', target: 'package.json', sessionID: 'vp-verified' });

    const error = await attempt(
      'edit',
      { filePath: 'package.json', oldString: '{}', newString: pkg({ prisma: '^5.0.0' }) },
      'vp-verified',
    );
    assert.ok(error, 'a verified version does not excuse writing the wrong major');
    assert.match(error.message, /Versão incorreta/);
    assert.match(error.message, /prisma=.*\^5\.0\.0/);
  });
});
