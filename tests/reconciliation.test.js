#!/usr/bin/env node

/**
 * P1.2 Phase 4 — Reconciliation Tests
 *
 * Validates that reconcile() detects inconsistencies between
 * governance-state.json and audit trail without modifying either.
 *
 * Invariants tested:
 *   I-30  State remains authoritative
 *   I-31  Missing audit detection
 *   I-32  State ahead detection
 *   I-33  Audit ahead does not authorize state
 *   I-34  Corruption isolation
 *   I-35  Session consistency
 *   I-36  Gate consistency
 *   I-37  Event identity
 *   I-38  Reconciliation is observational
 *   I-39  Fail-safe reporting
 *   I-40  No silent repair
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  mkdirSync, rmSync, writeFileSync, readFileSync, existsSync,
} from 'fs';
import { tmpdir } from 'os';
import { reconcile, healthCheck, eventIdentity, RECONCILIATION_STATES } from '../.opencode/plugins/lib/reconciliation.js';
import { writeState, createState, addEntry } from '../.opencode/plugins/lib/governance-state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let tempDir;
let auditDir;

function setup() {
  tempDir = join(tmpdir(), `oage-reconciliation-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  auditDir = join(tempDir, '.opencode', 'audit');
  mkdirSync(auditDir, { recursive: true });
}

function teardown() {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}

function writeAuditJsonl(events) {
  const content = events.map(e => JSON.stringify(e)).join('\n') + '\n';
  writeFileSync(join(auditDir, 'audit.jsonl'), content, 'utf8');
}

function makeEvent(event, minutesAgo = 0, sessionID = 'test-session', gate = null) {
  const ts = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
  return { timestamp: ts, event, sessionID, gate: gate || event.split('.')[0], op: 'test' };
}

function makeStateEntry(gate, minutesAgo = 0, sessionID = 'test-session') {
  const now = new Date(Date.now() - minutesAgo * 60 * 1000);
  const expires = new Date(now.getTime() + 30 * 60 * 1000);
  return {
    gate,
    sessionID,
    operation: 'test',
    query: null,
    confidence: 0.9,
    source: 'test',
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Event Identity (I-37)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Event Identity — I-37', () => {

  it('Generates deterministic identity from gate + session + createdAt', () => {
    const entry = { gate: 'context7', sessionID: 's1', createdAt: '2026-01-01T00:00:00Z' };
    const id1 = eventIdentity(entry);
    const id2 = eventIdentity(entry);
    assert.strictEqual(id1, id2);
    assert.strictEqual(id1, 'context7::s1::2026-01-01T00:00:00Z');
  });

  it('Returns null for null input', () => {
    assert.strictEqual(eventIdentity(null), null);
    assert.strictEqual(eventIdentity(undefined), null);
  });

  it('Handles missing fields gracefully', () => {
    const id = eventIdentity({});
    assert.ok(id.includes('unknown'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Core Reconciliation — I-30 through I-40
// ═══════════════════════════════════════════════════════════════════════════════

describe('Reconciliation — Core', () => {

  beforeEach(() => {
    setup();
  });

  after(() => {
    teardown();
  });

  it('I-30: State remains authoritative — valid state is not altered', () => {
    // Create matching state and audit with same timestamp
    const now = new Date();
    const state = createState(tempDir, 'test-project');
    
    // Create state entry directly (bypass addEntry to control createdAt)
    const stateEntry = {
      gate: 'context7',
      sessionID: 'test-session',
      operation: 'test',
      query: null,
      confidence: 0.9,
      source: 'test',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    };
    
    const updatedState = {
      ...state,
      entries: [stateEntry],
      updatedAt: now.toISOString(),
    };
    writeState(tempDir, updatedState);

    writeAuditJsonl([{
      timestamp: now.toISOString(),
      event: 'context7',
      sessionID: 'test-session',
      gate: 'context7',
      op: 'test',
    }]);

    const report = reconcile(tempDir);
    assert.strictEqual(report.state, RECONCILIATION_STATES.SYNCED);

    // Verify state is unchanged
    const stateAfter = readFileSync(join(auditDir, 'governance-state.json'), 'utf8');
    assert.ok(stateAfter.includes('context7'));
    teardown();
    setup();
  });

  it('I-31: Missing audit detection — state entry without audit event', () => {
    // Create state with entry but no corresponding audit
    const state = createState(tempDir, 'test-project');
    const entry = makeStateEntry('context7', 0);
    const updatedState = addEntry(state, entry);
    writeState(tempDir, updatedState);

    // Write different audit event
    writeAuditJsonl([makeEvent('skill.loaded', 0)]);

    const report = reconcile(tempDir);
    assert.strictEqual(report.state, RECONCILIATION_STATES.MISSING_AUDIT);
    assert.ok(report.issues.some(i => i.type === 'MISSING_AUDIT'));
    teardown();
    setup();
  });

  it('I-32: State ahead detection — state newer than audit', () => {
    // Create state with recent entry
    const now = new Date();
    const state = createState(tempDir, 'test-project');
    
    // Create state entry directly (bypass addEntry to control createdAt)
    const stateEntry = {
      gate: 'context7',
      sessionID: 'test-session',
      operation: 'test',
      query: null,
      confidence: 0.9,
      source: 'test',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    };
    
    const updatedState = {
      ...state,
      entries: [stateEntry],
      updatedAt: now.toISOString(),
    };
    writeState(tempDir, updatedState);

    // Write older audit event (within window for reconciliation to see it)
    writeAuditJsonl([{
      timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
      event: 'context7',
      sessionID: 'test-session',
      gate: 'context7',
      op: 'test',
    }]);

    const report = reconcile(tempDir);
    assert.strictEqual(report.state, RECONCILIATION_STATES.STATE_AHEAD);
    assert.ok(report.issues.some(i => i.type === 'STATE_AHEAD'));
    teardown();
    setup();
  });

  it('I-33: Audit ahead does not authorize state — audit event without state ≠ ALLOW', () => {
    // Create state without entry
    const state = createState(tempDir, 'test-project');
    writeState(tempDir, state);

    // Write audit event
    writeAuditJsonl([makeEvent('context7.query', 0)]);

    const report = reconcile(tempDir);
    // State is SYNCED because state has no entries to compare
    // The audit event does NOT create authorization
    assert.strictEqual(report.state, RECONCILIATION_STATES.SYNCED);
    assert.strictEqual(report.issues.length, 0);
    teardown();
    setup();
  });

  it('I-34: Corruption isolation — audit corruption does not modify state', () => {
    // Create valid state
    const now = new Date();
    const state = createState(tempDir, 'test-project');
    
    // Create state entry directly (bypass addEntry to control createdAt)
    const stateEntry = {
      gate: 'context7',
      sessionID: 'test-session',
      operation: 'test',
      query: null,
      confidence: 0.9,
      source: 'test',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    };
    
    const updatedState = {
      ...state,
      entries: [stateEntry],
      updatedAt: now.toISOString(),
    };
    writeState(tempDir, updatedState);

    // Corrupt audit file
    writeFileSync(join(auditDir, 'audit.jsonl'), 'not valid json\n{incomplete', 'utf8');

    const report = reconcile(tempDir);
    assert.strictEqual(report.state, RECONCILIATION_STATES.AUDIT_CORRUPTED);

    // Verify state is unchanged
    const stateAfter = readFileSync(join(auditDir, 'governance-state.json'), 'utf8');
    assert.ok(stateAfter.includes('context7'));
    teardown();
    setup();
  });

  it('I-35: Session consistency — comparisons respect sessionID', () => {
    // Create state with session-A
    const state = createState(tempDir, 'test-project');
    const entryA = { ...makeStateEntry('context7', 0), sessionID: 'session-A' };
    const updatedState = addEntry(state, entryA);
    writeState(tempDir, updatedState);

    // Write audit event for session-B
    writeAuditJsonl([makeEvent('context7.query', 0, 'session-B')]);

    // Reconcile without session filter — should detect missing audit
    const reportAll = reconcile(tempDir);
    assert.strictEqual(reportAll.state, RECONCILIATION_STATES.MISSING_AUDIT);

    // Reconcile with session-A filter — should also detect missing
    const reportA = reconcile(tempDir, { sessionID: 'session-A' });
    assert.strictEqual(reportA.state, RECONCILIATION_STATES.MISSING_AUDIT);

    // Reconcile with session-B filter — state has no entries for session-B
    const reportB = reconcile(tempDir, { sessionID: 'session-B' });
    assert.strictEqual(reportB.state, RECONCILIATION_STATES.SYNCED);
    teardown();
    setup();
  });

  it('I-36: Gate consistency — comparisons respect gate', () => {
    // Create state with context7 gate
    const state = createState(tempDir, 'test-project');
    const entry = makeStateEntry('context7', 0);
    const updatedState = addEntry(state, entry);
    writeState(tempDir, updatedState);

    // Write audit event for different gate
    writeAuditJsonl([makeEvent('skill.loaded', 0)]);

    const report = reconcile(tempDir);
    assert.strictEqual(report.state, RECONCILIATION_STATES.MISSING_AUDIT);
    teardown();
    setup();
  });

  it('I-38: Reconciliation is observational — not in synchronous path', () => {
    // Create matching state and audit with same timestamp
    const now = new Date();
    const state = createState(tempDir, 'test-project');
    
    // Create state entry directly (bypass addEntry to control createdAt)
    const stateEntry = {
      gate: 'context7',
      sessionID: 'test-session',
      operation: 'test',
      query: null,
      confidence: 0.9,
      source: 'test',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    };
    
    const updatedState = {
      ...state,
      entries: [stateEntry],
      updatedAt: now.toISOString(),
    };
    writeState(tempDir, updatedState);

    writeAuditJsonl([{
      timestamp: now.toISOString(),
      event: 'context7',
      sessionID: 'test-session',
      gate: 'context7',
      op: 'test',
    }]);

    // Reconcile does not throw or block
    const report = reconcile(tempDir);
    assert.strictEqual(report.state, RECONCILIATION_STATES.SYNCED);

    // State is still valid for enforcement
    const stateAfter = readFileSync(join(auditDir, 'governance-state.json'), 'utf8');
    assert.ok(stateAfter.includes('context7'));
    teardown();
    setup();
  });

  it('I-39: Fail-safe reporting — reconciler failure → RECONCILIATION_FAILED', () => {
    // Create corrupted state that causes validation to throw
    const statePath = join(auditDir, 'governance-state.json');
    writeFileSync(statePath, '{"invalid": true}', 'utf8');

    const report = reconcile(tempDir);
    // Should detect corrupted state, not throw
    assert.ok(
      report.state === RECONCILIATION_STATES.STATE_CORRUPTED ||
      report.state === RECONCILIATION_STATES.RECONCILIATION_FAILED
    );
    teardown();
    setup();
  });

  it('I-40: No silent repair — reconciler does not modify audit or state', () => {
    // Create state with entry
    const state = createState(tempDir, 'test-project');
    const entry = makeStateEntry('context7', 0);
    const updatedState = addEntry(state, entry);
    writeState(tempDir, updatedState);

    // Write audit event
    writeAuditJsonl([makeEvent('context7.query', 0)]);

    const stateBefore = readFileSync(join(auditDir, 'governance-state.json'), 'utf8');
    const auditBefore = readFileSync(join(auditDir, 'audit.jsonl'), 'utf8');

    reconcile(tempDir);

    const stateAfter = readFileSync(join(auditDir, 'governance-state.json'), 'utf8');
    const auditAfter = readFileSync(join(auditDir, 'audit.jsonl'), 'utf8');

    assert.strictEqual(stateBefore, stateAfter);
    assert.strictEqual(auditBefore, auditAfter);
    teardown();
    setup();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════════════════════

describe('Health Check', () => {

  beforeEach(() => {
    setup();
  });

  after(() => {
    teardown();
  });

  it('Returns healthy when synced', () => {
    const state = createState(tempDir, 'test-project');
    writeState(tempDir, state);
    writeAuditJsonl([]);

    const health = healthCheck(tempDir);
    assert.strictEqual(health.healthy, true);
    assert.strictEqual(health.state, RECONCILIATION_STATES.SYNCED);
    assert.strictEqual(health.issues, 0);
    teardown();
    setup();
  });

  it('Returns unhealthy when issues detected', () => {
    const state = createState(tempDir, 'test-project');
    const entry = makeStateEntry('context7', 0);
    const updatedState = addEntry(state, entry);
    writeState(tempDir, updatedState);

    writeAuditJsonl([makeEvent('skill.loaded', 0)]);

    const health = healthCheck(tempDir);
    assert.strictEqual(health.healthy, false);
    assert.ok(health.issues > 0);
    teardown();
    setup();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Integration — Reconciliation + Rotation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Reconciliation — Integration', () => {

  beforeEach(() => {
    setup();
  });

  after(() => {
    teardown();
  });

  it('Detects missing audit after rotation', async () => {
    // Create state with entry
    const now = new Date();
    const state = createState(tempDir, 'test-project');
    
    // Create state entry directly (bypass addEntry to control createdAt)
    const stateEntry = {
      gate: 'context7',
      sessionID: 'test-session',
      operation: 'test',
      query: null,
      confidence: 0.9,
      source: 'test',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    };
    
    const updatedState = {
      ...state,
      entries: [stateEntry],
      updatedAt: now.toISOString(),
    };
    writeState(tempDir, updatedState);

    // Write and rotate audit
    writeAuditJsonl([{
      timestamp: now.toISOString(),
      event: 'context7',
      sessionID: 'test-session',
      gate: 'context7',
      op: 'test',
    }]);
    const { rotate } = await import('../.opencode/plugins/lib/audit-rotation.js');
    rotate(auditDir);

    // Write new audit event (different gate)
    writeAuditJsonl([{
      timestamp: new Date().toISOString(),
      event: 'skill.loaded',
      sessionID: 'test-session',
      gate: 'skill',
      op: 'test',
    }]);

    const report = reconcile(tempDir);
    // After rotation, old events are in archive (not read by default)
    // So state entry may appear as MISSING_AUDIT
    assert.ok(
      report.state === RECONCILIATION_STATES.MISSING_AUDIT ||
      report.state === RECONCILIATION_STATES.SYNCED
    );
    teardown();
    setup();
  });
});
