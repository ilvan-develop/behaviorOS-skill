#!/usr/bin/env node

/**
 * behaviorOS - Loop Governance (OAGE P1.1)
 *
 * Tested from both sides, deliberately.
 *
 * The F6 finding was not "the detector missed a loop" — it was the opposite: the detector
 * blocked a legitimate write, and the model went looking for a heredoc bypass instead of
 * escalating. A gate that over-blocks legitimate work teaches agents to route around
 * governance, so a false positive here is a security defect, not a usability complaint.
 *
 * Hence: ATTACK tests that the ladder cannot be evaded, and FALSE-POSITIVE tests that ordinary
 * work is never touched.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { join, dirname, sep } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, cpSync } from 'fs';
import { tmpdir } from 'os';
import { OageEnforce } from '../.opencode/plugins/oage-enforce.js';
import {
  classifyAction,
  scoreAction,
  detectNoop,
  buildSignature,
  loadLoopState,
  projectId,
  LOOP_STATE_SCHEMA_VERSION,
} from '../.opencode/plugins/lib/loop-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

let FIXTURE;
let before_;
let after_;
let callSeq = 0;

/** Drive the real hooks. Returns the verdict level seen by the agent, or 'BLOCKED'. */
async function attempt(tool, args, { sessionID = 'ses-a', command } = {}) {
  callSeq += 1;
  const callID = `call-${callSeq}`;
  const input = { tool, sessionID, callID };
  try {
    await before_(input, { args: command ? { command } : args });
  } catch (error) {
    return { level: 'BLOCKED', message: error.message };
  }
  // The after hook is where WARN/ESCALATE reach the agent.
  const out = { title: 't', output: 'ok', metadata: {} };
  await after_({ ...input, args }, out);
  const match = out.output.match(/\[OAGE (WARN|ESCALATE)\]/);
  return { level: match ? match[1] : 'NORMAL', message: out.output };
}

/** Run the same call n times, collecting the ladder. */
async function repeat(n, tool, args, opts) {
  const levels = [];
  for (let i = 0; i < n; i += 1) levels.push((await attempt(tool, args, opts)).level);
  return levels;
}

function loopStatePath() {
  return join(FIXTURE, '.opencode', 'audit', 'loop-state.json');
}

function auditEvents() {
  const file = join(FIXTURE, '.opencode', 'audit', 'audit.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function resetState() {
  rmSync(loopStatePath(), { force: true });
  rmSync(join(FIXTURE, '.opencode', 'audit', 'audit.jsonl'), { force: true });
}

before(async () => {
  FIXTURE = join(tmpdir(), `oage-loop-${process.pid}`);
  rmSync(FIXTURE, { recursive: true, force: true });
  mkdirSync(join(FIXTURE, '.opencode', 'governance'), { recursive: true });
  mkdirSync(join(FIXTURE, 'src'), { recursive: true });

  cpSync(join(ROOT_DIR, 'templates', 'base', 'governance'), join(FIXTURE, '.opencode', 'governance'), { recursive: true });
  writeFileSync(join(FIXTURE, '.opencode', 'governance', 'state-machine.json'), JSON.stringify({ currentState: 'F1' }));
  writeFileSync(join(FIXTURE, 'src', 'a.ts'), 'export const a = 1;\n');

  const plugin = await OageEnforce({ directory: FIXTURE });
  before_ = plugin['tool.execute.before'];
  after_ = plugin['tool.execute.after'];
});

after(() => {
  try { rmSync(FIXTURE, { recursive: true, force: true }); } catch { /* OS temp */ }
});

beforeEach(() => resetState());

// ─────────────────────────────────────────────────────────────────────────────
// ATTACK
// ─────────────────────────────────────────────────────────────────────────────

describe('ATTACK — the ladder cannot be evaded', () => {
  it('warns, then escalates, then blocks — never blocks first', async () => {
    const levels = await repeat(6, 'write', { filePath: 'src/loop.ts', content: 'same\n' });

    assert.equal(levels[0], 'NORMAL', 'a first attempt must never be flagged');
    assert.ok(levels.includes('WARN'), `expected a WARN step, got ${levels.join(' → ')}`);
    assert.ok(levels.includes('ESCALATE'), `expected an ESCALATE step, got ${levels.join(' → ')}`);
    assert.equal(levels.at(-1), 'BLOCKED');
    assert.ok(
      levels.indexOf('WARN') < levels.indexOf('ESCALATE'),
      `the ladder must be ordered, got ${levels.join(' → ')}`,
    );
  });

  it('collapses every spelling of the same target into one signature', async () => {
    const abs = join(FIXTURE, 'src', 'dup.ts');
    const spellings = [
      'src/dup.ts',
      './src/dup.ts',
      abs,
      abs.split(sep).join('/'),
      `src${sep}dup.ts`,
    ];

    const levels = [];
    for (const filePath of spellings) {
      levels.push((await attempt('write', { filePath, content: 'same\n' })).level);
    }

    assert.equal(levels.at(-1), 'BLOCKED', `re-spelling the path must not reset the count: ${levels.join(' → ')}`);
    const state = JSON.parse(readFileSync(loopStatePath(), 'utf8'));
    assert.equal(Object.keys(state.signatures).length, 1, 'five spellings must be one signature');
  });

  it('escalates a no-op edit faster than an effective one', async () => {
    writeFileSync(join(FIXTURE, 'src', 'noop.ts'), 'const x = 1;\n');
    const noopLevels = await repeat(3, 'edit', { filePath: 'src/noop.ts', oldString: 'same', newString: 'same' });

    resetState();
    const effective = [];
    for (let i = 0; i < 3; i += 1) {
      effective.push((await attempt('edit', { filePath: 'src/eff.ts', oldString: `v${i}`, newString: `v${i + 1}` })).level);
    }

    const rank = { NORMAL: 0, WARN: 1, ESCALATE: 2, BLOCKED: 3 };
    assert.ok(
      rank[noopLevels.at(-1)] > rank[effective.at(-1)],
      `no-op ${noopLevels.join('→')} must outrank effective ${effective.join('→')}`,
    );
  });

  it('counts a heredoc rewrite as the mutation it is', async () => {
    const cmd = `cat > src/via-shell.ts <<'EOF'\nexport const s = 1;\nEOF`;
    const levels = [];
    for (let i = 0; i < 6; i += 1) levels.push((await attempt('bash', {}, { command: cmd })).level);
    assert.ok(
      levels.includes('BLOCKED') || levels.includes('ESCALATE'),
      `shell rewrites must reach the ladder, got ${levels.join(' → ')}`,
    );
  });

  it('blocks the call after an escalation, even below the block threshold', async () => {
    const args = { filePath: 'src/armed.ts', content: 'same\n' };
    const levels = await repeat(6, 'write', args);
    const escalateAt = levels.indexOf('ESCALATE');
    assert.ok(escalateAt >= 0, `no escalation happened: ${levels.join(' → ')}`);
    assert.equal(levels[escalateAt + 1], 'BLOCKED', 'the call right after an escalation must be refused');
  });

  it('weights a governance mutation above an ordinary write', () => {
    const cfg = JSON.parse(readFileSync(join(FIXTURE, '.opencode', 'governance', 'loop-detector.json'), 'utf8'));
    const governance = classifyAction(FIXTURE, { tool: 'write', target: '.opencode/governance/risk-engine.json', args: { content: 'x' } }, cfg);
    const ordinary = classifyAction(FIXTURE, { tool: 'write', target: 'src/a.ts', args: { content: 'x' } }, cfg);

    assert.equal(governance.actionClass, 'GOVERNANCE_MUTATION');
    assert.ok(
      scoreAction(FIXTURE, governance, cfg) > scoreAction(FIXTURE, ordinary, cfg),
      'mutating the kernel must outweigh editing a source file',
    );
  });

  it('records every rung in the audit trail', async () => {
    await repeat(6, 'write', { filePath: 'src/audited.ts', content: 'same\n' });
    const events = auditEvents().map((e) => e.event);
    for (const expected of ['loop_warning', 'escalation_required', 'loop_detected']) {
      assert.ok(events.includes(expected), `missing ${expected} in ${[...new Set(events)].join(', ')}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FALSE POSITIVES — over-blocking is itself the vulnerability
// ─────────────────────────────────────────────────────────────────────────────

describe('FALSE POSITIVE — ordinary work is never touched', () => {
  it('never counts reads, however many', async () => {
    for (let i = 0; i < 10; i += 1) {
      const { level } = await attempt('read', { filePath: 'src/a.ts' });
      assert.equal(level, 'NORMAL', 'reading is not repetition');
    }
    assert.ok(!existsSync(loopStatePath()), 'a read must not even create loop state');
  });

  it('does not flag iterating on a file — different content each time', async () => {
    for (let i = 0; i < 8; i += 1) {
      const { level } = await attempt('write', { filePath: 'src/iter.ts', content: `export const v = ${i};\n` });
      assert.equal(level, 'NORMAL', `iteration ${i} was flagged`);
    }
  });

  it('does not flag writes to different files', async () => {
    for (let i = 0; i < 6; i += 1) {
      const { level } = await attempt('write', { filePath: `src/file-${i}.ts`, content: 'same\n' });
      assert.equal(level, 'NORMAL', `distinct target ${i} was flagged`);
    }
  });

  it('does not carry a counter across a phase boundary', async () => {
    const smPath = join(FIXTURE, '.opencode', 'governance', 'state-machine.json');
    const args = { filePath: 'src/phase.ts', content: 'same\n' };

    writeFileSync(smPath, JSON.stringify({ currentState: 'F0' }));
    const inF0 = await repeat(4, 'write', args);
    assert.ok(!inF0.includes('BLOCKED'), 'setup: F0 should not have blocked yet');

    writeFileSync(smPath, JSON.stringify({ currentState: 'F2' }));
    const { level } = await attempt('write', args);
    assert.equal(level, 'NORMAL', 'the same action in a new phase starts clean');

    writeFileSync(smPath, JSON.stringify({ currentState: 'F1' }));
  });

  it('does not let one session inherit another session\'s repetition', async () => {
    const args = { filePath: 'src/session.ts', content: 'same\n' };
    await repeat(5, 'write', args, { sessionID: 'ses-old' });
    const { level } = await attempt('write', args, { sessionID: 'ses-new' });
    assert.equal(level, 'NORMAL', 'a fresh session must not inherit a block it never caused');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// State is governed, not accidental memory
// ─────────────────────────────────────────────────────────────────────────────

describe('loop-state is governed state', () => {
  it('carries a schema, kernel version and project identity', async () => {
    await attempt('write', { filePath: 'src/env.ts', content: 'same\n' });
    const state = JSON.parse(readFileSync(loopStatePath(), 'utf8'));

    assert.equal(state.schemaVersion, LOOP_STATE_SCHEMA_VERSION);
    assert.equal(state.projectId, projectId(FIXTURE));
    assert.ok(state.kernelVersion, 'kernelVersion missing');
    assert.ok(state.createdAt && state.updatedAt);
  });

  it('discards state from an incompatible schema instead of migrating it', () => {
    writeFileSync(loopStatePath(), JSON.stringify({
      signatures: { 'write:C:\\old\\path:': { timestamps: [Date.now()] } },
    }));
    const state = loadLoopState(FIXTURE);
    assert.deepEqual(state.signatures, {}, 'v1 state must be dropped, not carried forward');
    assert.equal(state.schemaVersion, LOOP_STATE_SCHEMA_VERSION);
  });

  it('discards state belonging to another project', () => {
    // The real file held 36 signatures naming brocolis-app, silently governing this repo.
    writeFileSync(loopStatePath(), JSON.stringify({
      schemaVersion: LOOP_STATE_SCHEMA_VERSION,
      projectId: 'deadbeefcafe',
      signatures: { 'someone-elses-signature': { events: [[Date.now(), 99]] } },
    }));
    const state = loadLoopState(FIXTURE);
    assert.deepEqual(state.signatures, {}, "another project's state must never govern this one");
  });

  it('drops signatures once their window has passed', async () => {
    const stale = Date.now() - 60 * 60 * 1000; // an hour ago, window is 15 min
    writeFileSync(loopStatePath(), JSON.stringify({
      schemaVersion: LOOP_STATE_SCHEMA_VERSION,
      projectId: projectId(FIXTURE),
      signatures: { 'stale-signature': { events: [[stale, 5]] } },
    }));

    await attempt('write', { filePath: 'src/prune.ts', content: 'same\n' });

    const state = JSON.parse(readFileSync(loopStatePath(), 'utf8'));
    assert.ok(!('stale-signature' in state.signatures), 'expired keys must be removed, not just their timestamps');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mechanism
// ─────────────────────────────────────────────────────────────────────────────

describe('The declared signature drives the real one', () => {
  it('composes the signature from the config field, which used to have no consumer', () => {
    const cfg = JSON.parse(readFileSync(join(ROOT_DIR, 'templates', 'base', 'governance', 'loop-detector.json'), 'utf8'));
    const fields = {
      schemaVersion: 2, projectId: 'p', sessionId: 's', agent: 'a',
      phase: 'F1', actionClass: 'WRITE', canonicalTarget: 'src/x.ts', mutationFingerprint: 'abc',
    };

    assert.deepEqual(cfg.signature, Object.keys(fields), 'config order must match what the engine builds');
    assert.equal(buildSignature(fields, cfg), '2|p|s|a|F1|WRITE|src/x.ts|abc');

    // Change the declared composition and the signature changes with it.
    const narrower = buildSignature(fields, { signature: ['actionClass', 'canonicalTarget'] });
    assert.equal(narrower, 'WRITE|src/x.ts');
  });

  it('reads weigh nothing regardless of how risky the file is', () => {
    const cfg = JSON.parse(readFileSync(join(FIXTURE, '.opencode', 'governance', 'loop-detector.json'), 'utf8'));
    const action = classifyAction(FIXTURE, { tool: 'read', target: 'src/payment/service.ts', args: {} }, cfg);
    assert.equal(scoreAction(FIXTURE, action, cfg), 0);
  });

  it('detects a no-op edit and a no-op write', () => {
    writeFileSync(join(FIXTURE, 'src', 'known.ts'), 'hello\n');

    assert.equal(detectNoop(FIXTURE, { tool: 'write', target: 'src/known.ts', args: { content: 'hello\n' } }), true);
    assert.equal(detectNoop(FIXTURE, { tool: 'write', target: 'src/known.ts', args: { content: 'different\n' } }), false);
    assert.equal(detectNoop(FIXTURE, { tool: 'edit', target: 'src/known.ts', args: { oldString: 'a', newString: 'a' } }), true);
    // Already applied: the new text is there and the old text is gone.
    assert.equal(detectNoop(FIXTURE, { tool: 'edit', target: 'src/known.ts', args: { oldString: 'goodbye', newString: 'hello' } }), true);
    assert.equal(detectNoop(FIXTURE, { tool: 'edit', target: 'src/known.ts', args: { oldString: 'hello', newString: 'goodbye' } }), false);
  });

  it('the contract no longer claims an escalate mode the code contradicts', () => {
    const contract = JSON.parse(readFileSync(join(ROOT_DIR, 'templates', 'base', 'governance', 'governance-contract.json'), 'utf8'));
    const entry = contract.policies['loop-detector.json'];
    assert.equal(entry.failureMode, 'escalate');
    assert.ok(
      entry.adversarialTests.includes('tests/loop-governance.test.js'),
      'the policy must name the test that proves its ladder',
    );
    assert.ok(!/blocks outright/i.test(entry.note || ''), 'the contradiction note should be gone');
  });
});
