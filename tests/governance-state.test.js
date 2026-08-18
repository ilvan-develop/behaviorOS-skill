import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync,
} from 'fs';
import { tmpdir } from 'os';
import {
  GOVERNANCE_STATE_VERSION,
  createState,
  addEntry,
  validateState,
  readState,
  writeState,
  getValidEntry,
  hasValidEntry,
  isEntryValid,
  pruneExpired,
  DEFAULT_TTL,
} from '../.opencode/plugins/lib/governance-state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let tempDir;
let auditDir;

function setup() {
  tempDir = join(tmpdir(), `oage-govstate-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  auditDir = join(tempDir, '.opencode', 'audit');
  mkdirSync(auditDir, { recursive: true });
}

function teardown() {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}

beforeEach(() => setup());
afterEach(() => teardown());

function freshState(overrides = {}) {
  return { ...createState(tempDir, 'test-project'), ...overrides };
}

function entry(gate, minutesAgo = 0, sessionID = 'test-session', ttlMinutes = 30) {
  const now = new Date(Date.now() - minutesAgo * 60 * 1000);
  return {
    gate,
    sessionID,
    operation: 'test',
    query: null,
    confidence: 90,
    source: 'test',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString(),
  };
}

describe('Governance State — I-01 TTL', () => {
  it('addEntry computes expiresAt = createdAt + ttlMinutes[gate]', () => {
    const state = freshState();
    const updated = addEntry(state, { gate: 'context7', sessionID: 's1' });
    assert.strictEqual(updated.entries.length, 1);
    const e = updated.entries[0];
    const created = new Date(e.createdAt).getTime();
    const expires = new Date(e.expiresAt).getTime();
    assert.strictEqual(expires, created + DEFAULT_TTL.context7 * 60 * 1000);
  });

  it('I-01: validateState rejects an entry without expiresAt', () => {
    const bad = freshState({
      entries: [{ gate: 'context7', sessionID: 's1', createdAt: new Date().toISOString() }],
    });
    const result = validateState(bad);
    assert.strictEqual(result.valid, false);
    assert.match(result.reason, /expiresAt/);
  });
});

describe('Governance State — I-02 Session', () => {
  it('addEntry preserves the provided sessionID', () => {
    const updated = addEntry(freshState(), { gate: 'skill', sessionID: 'session-A' });
    assert.strictEqual(updated.entries[0].sessionID, 'session-A');
  });

  it('addEntry defaults a missing sessionID to "unknown"', () => {
    const updated = addEntry(freshState(), { gate: 'skill' });
    assert.strictEqual(updated.entries[0].sessionID, 'unknown');
  });

  it('I-02: validateState rejects an entry without sessionID', () => {
    const bad = freshState({
      entries: [entry('context7', 0, null)],
    });
    bad.entries[0].sessionID = undefined;
    const result = validateState(bad);
    assert.strictEqual(result.valid, false);
    assert.match(result.reason, /sessionID/);
  });
});

describe('Governance State — I-03/I-06 Fail-closed decision', () => {
  it('getValidEntry returns null for an expired entry — expired is never ALLOW', () => {
    const state = freshState();
    const old = entry('context7', 120, 's1', 30);
    writeState(tempDir, { ...state, entries: [old], updatedAt: new Date().toISOString() });
    assert.strictEqual(isEntryValid(old), false);
    assert.strictEqual(getValidEntry(tempDir, 'context7', 's1'), null);
    assert.strictEqual(hasValidEntry(tempDir, 'context7', 's1'), false);
  });

  it('getValidEntry returns the entry when valid and session matches', () => {
    const state = freshState();
    const current = entry('context7', 0, 's1', 30);
    writeState(tempDir, { ...state, entries: [current], updatedAt: new Date().toISOString() });
    const got = getValidEntry(tempDir, 'context7', 's1');
    assert.ok(got);
    assert.strictEqual(got.gate, 'context7');
    assert.strictEqual(got.sessionID, 's1');
  });

  it('I-06: missing state file → readState null and getValidEntry null (DENY)', () => {
    assert.strictEqual(readState(tempDir), null);
    assert.strictEqual(getValidEntry(tempDir, 'context7', 's1'), null);
  });

  it('I-06: corrupt state file → readState null and getValidEntry null (DENY)', () => {
    writeFileSync(join(auditDir, 'governance-state.json'), '{not json', 'utf8');
    assert.strictEqual(readState(tempDir), null);
    assert.strictEqual(getValidEntry(tempDir, 'context7', 's1'), null);
  });

  it('I-06: invalid state (wrong schemaVersion) → getValidEntry null (DENY)', () => {
    writeFileSync(join(auditDir, 'governance-state.json'), JSON.stringify({
      version: '1.0.0', schemaVersion: 99, projectId: 'x', entries: [],
    }), 'utf8');
    const state = readState(tempDir);
    assert.strictEqual(validateState(state).valid, false);
    assert.strictEqual(getValidEntry(tempDir, 'context7', 's1'), null);
  });
});

describe('Governance State — I-04 Atomic write', () => {
  it('writeState persists a valid state with no leftover temp files', () => {
    const state = freshState();
    const updated = addEntry(state, { gate: 'truth', sessionID: 's1' });
    writeState(tempDir, updated);

    const reloaded = readState(tempDir);
    assert.ok(reloaded);
    assert.strictEqual(reloaded.entries.length, 1);

    const leftover = readdirSync(auditDir).filter((f) => f.includes('.tmp.'));
    assert.deepStrictEqual(leftover, []);
  });

  it('I-04: writeState throws on invalid state instead of persisting it', () => {
    const bad = freshState({ schemaVersion: 99 });
    assert.throws(() => writeState(tempDir, bad));
  });
});

describe('Governance State — I-05 Schema versioned', () => {
  it('validateState accepts the current schemaVersion', () => {
    assert.strictEqual(validateState(freshState()).valid, true);
  });

  it('I-05: validateState rejects a schemaVersion mismatch', () => {
    const result = validateState(freshState({ schemaVersion: GOVERNANCE_STATE_VERSION + 1 }));
    assert.strictEqual(result.valid, false);
    assert.match(result.reason, /Schema version mismatch/);
  });

  it('I-05: loadState discards an incompatible schema and creates a fresh state', async () => {
    const { loadState, initState } = await import('../.opencode/plugins/lib/governance-state.js');
    writeFileSync(join(auditDir, 'governance-state.json'), JSON.stringify({
      version: '1.0.0', schemaVersion: 99, projectId: 'x', entries: [],
    }), 'utf8');
    const loaded = loadState(tempDir, 'test-project');
    assert.strictEqual(loaded.schemaVersion, GOVERNANCE_STATE_VERSION);
    assert.strictEqual(loaded.projectId, 'test-project');
    const again = initState(tempDir, 'test-project');
    assert.strictEqual(again.schemaVersion, GOVERNANCE_STATE_VERSION);
  });
});

describe('Governance State — I-09 LRU eviction', () => {
  it('addEntry trims to maxEntries keeping the most recent', () => {
    const state = freshState({ maxEntries: 3 });
    let current = state;
    for (let i = 0; i < 6; i++) {
      current = addEntry(current, { gate: 'context7', sessionID: `s${i}` });
    }
    assert.strictEqual(current.entries.length, 3);
    const sessions = current.entries.map((e) => e.sessionID);
    assert.deepStrictEqual(sessions, ['s3', 's4', 's5']);
  });
});

describe('Governance State — I-10 Append-only semantics', () => {
  it('addEntry appends a new entry without modifying prior entries', () => {
    const state = freshState();
    const first = addEntry(state, { gate: 'context7', sessionID: 's1', query: 'a' });
    const firstCopy = JSON.parse(JSON.stringify(first));
    const second = addEntry(first, { gate: 'skill', sessionID: 's2', query: 'b' });

    assert.strictEqual(second.entries.length, 2);
    assert.deepStrictEqual(second.entries[0], firstCopy.entries[0]);
    assert.strictEqual(second.entries[1].query, 'b');
  });
});

describe('Governance State — validateState structural rules', () => {
  it('rejects null / non-object state', () => {
    assert.strictEqual(validateState(null).valid, false);
    assert.strictEqual(validateState('nope').valid, false);
  });

  it('rejects a missing projectId', () => {
    const bad = freshState();
    bad.projectId = undefined;
    assert.strictEqual(validateState(bad).valid, false);
  });

  it('rejects a missing entries array', () => {
    const bad = freshState();
    bad.entries = undefined;
    assert.strictEqual(validateState(bad).valid, false);
  });

  it('rejects an entry with expiresAt <= createdAt', () => {
    const bad = freshState({
      entries: [{ gate: 'context7', sessionID: 's1', createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2025-01-01T00:00:00.000Z' }],
    });
    const result = validateState(bad);
    assert.strictEqual(result.valid, false);
    assert.match(result.reason, /expiresAt <= createdAt/);
  });

  it('pruneExpired drops expired entries only', () => {
    const state = freshState();
    const expired = entry('context7', 300, 's1', 30);
    const current = entry('skill', 0, 's2', 240);
    const pruned = pruneExpired({ ...state, entries: [expired, current] });
    assert.strictEqual(pruned.entries.length, 1);
    assert.strictEqual(pruned.entries[0].sessionID, 's2');
  });
});
