#!/usr/bin/env node

/**
 * P1.2 Phase 3 — Windowed Reader Tests
 *
 * Validates that readAuditWindow() provides bounded, efficient reads
 * from current.jsonl without touching archive or modifying state.
 *
 * Invariants tested:
 *   I-20  Reader respects temporal window
 *   I-21  Reader does not read beyond necessary window
 *   I-22  Reader supports empty current.jsonl
 *   I-23  Reader supports partially corrupted file
 *   I-24  Reader does not modify audit trail
 *   I-25  Reader does not modify governance-state
 *   I-26  Reader maintains backward compatibility with readAuditEvents
 *   I-27  Events outside window are not returned
 *   I-28  Events inside window are preserved
 *   I-29  Reader cannot authorize an operation
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  mkdirSync, rmSync, writeFileSync, readFileSync, existsSync,
} from 'fs';
import { tmpdir } from 'os';
import { readAuditWindow, readAuditEventsCompat, readArchiveEvents, rotate, DEFAULT_CONFIG } from '../.opencode/plugins/lib/audit-rotation.js';
import { readAuditEvents } from '../.opencode/plugins/lib/oage-lib.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let tempDir;
let auditDir;

function setup() {
  tempDir = join(tmpdir(), `oage-windowed-reader-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

function makeEvent(event, minutesAgo = 0) {
  const ts = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
  return { timestamp: ts, event, sessionID: 'test-session', op: 'test' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Unit Tests — I-20 through I-29
// ═══════════════════════════════════════════════════════════════════════════════

describe('Windowed Reader — Unit', () => {

  beforeEach(() => {
    setup();
  });

  after(() => {
    teardown();
  });

  it('I-20: Reader respects temporal window (default 30 min)', () => {
    writeAuditJsonl([
      makeEvent('gating.started', 0),
      makeEvent('gating.started', 10),
      makeEvent('gating.started', 25),
    ]);

    const events = readAuditWindow(auditDir);
    assert.strictEqual(events.length, 3);
    teardown();
    setup();
  });

  it('I-20: Reader respects custom windowMinutes', () => {
    writeAuditJsonl([
      makeEvent('gating.started', 0),
      makeEvent('gating.started', 5),
      makeEvent('gating.started', 15),
    ]);

    const events = readAuditWindow(auditDir, { windowMinutes: 10 });
    assert.strictEqual(events.length, 2);
    teardown();
    setup();
  });

  it('I-21: Reader does not read beyond necessary window', () => {
    const events = [];
    for (let i = 0; i < 100; i++) {
      events.push(makeEvent('gating.started', i));
    }
    writeAuditJsonl(events);

    const result = readAuditWindow(auditDir, { limit: 5 });
    assert.strictEqual(result.length, 5);
    teardown();
    setup();
  });

  it('I-22: Reader supports empty current.jsonl', () => {
    writeFileSync(join(auditDir, 'audit.jsonl'), '', 'utf8');

    const events = readAuditWindow(auditDir);
    assert.deepStrictEqual(events, []);
    teardown();
    setup();
  });

  it('I-22: Reader supports missing current.jsonl', () => {
    const events = readAuditWindow(auditDir);
    assert.deepStrictEqual(events, []);
    teardown();
    setup();
  });

  it('I-23: Reader supports partially corrupted file', () => {
    writeAuditJsonl([
      makeEvent('gating.started', 0),
      makeEvent('gating.started', 5),
    ]);

    const corruptLines = 'not valid json\n{incomplete json\n';
    const currentPath = join(auditDir, 'audit.jsonl');
    const currentContent = readFileSync(currentPath, 'utf8');
    writeFileSync(currentPath, currentContent + corruptLines, 'utf8');

    const events = readAuditWindow(auditDir);
    assert.strictEqual(events.length, 2);
    teardown();
    setup();
  });

  it('I-24: Reader does not modify audit trail', () => {
    writeAuditJsonl([
      makeEvent('gating.started', 0),
      makeEvent('gating.started', 5),
    ]);

    const before = readFileSync(join(auditDir, 'audit.jsonl'), 'utf8');
    readAuditWindow(auditDir);
    const after = readFileSync(join(auditDir, 'audit.jsonl'), 'utf8');

    assert.strictEqual(before, after);
    teardown();
    setup();
  });

  it('I-25: Reader does not modify governance-state', () => {
    const gsPath = join(tempDir, '.opencode', 'governance', 'governance-state.json');
    mkdirSync(join(tempDir, '.opencode', 'governance'), { recursive: true });
    writeFileSync(gsPath, JSON.stringify({ version: 1, entries: [] }), 'utf8');

    writeAuditJsonl([makeEvent('gating.started', 0)]);
    const before = readFileSync(gsPath, 'utf8');

    readAuditWindow(auditDir);
    const after = readFileSync(gsPath, 'utf8');

    assert.strictEqual(before, after);
    teardown();
    setup();
  });

  it('I-26: readAuditEventsCompat maintains backward compatibility', () => {
    writeAuditJsonl([
      makeEvent('gating.started', 0),
      makeEvent('gating.started', 5),
    ]);

    const compatResult = readAuditEventsCompat(tempDir);
    assert.strictEqual(compatResult.length, 2);
    teardown();
    setup();
  });

  it('I-26: readAuditEvents in oage-lib.js delegates to windowed reader', () => {
    writeAuditJsonl([
      makeEvent('gating.started', 0),
      makeEvent('gating.started', 5),
    ]);

    const result = readAuditEvents(tempDir);
    assert.strictEqual(result.length, 2);
    teardown();
    setup();
  });

  it('I-27: Events outside window are not returned', () => {
    writeAuditJsonl([
      makeEvent('gating.started', 0),
      makeEvent('gating.started', 60),
    ]);

    const events = readAuditWindow(auditDir, { windowMinutes: 30 });
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].event, 'gating.started');
    teardown();
    setup();
  });

  it('I-28: Events inside window are preserved', () => {
    writeAuditJsonl([
      makeEvent('context7.query', 1),
      makeEvent('skill.loaded', 2),
      makeEvent('gating.started', 3),
    ]);

    const events = readAuditWindow(auditDir, { windowMinutes: 10 });
    assert.strictEqual(events.length, 3);
    teardown();
    setup();
  });

  it('I-29: Reader cannot authorize an operation (returns events, not ALLOW/DENY)', () => {
    writeAuditJsonl([makeEvent('gating.started', 0)]);

    const result = readAuditWindow(auditDir);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].decision, undefined);
    assert.strictEqual(result[0].authorized, undefined);
    teardown();
    setup();
  });

  it('Filter by event type', () => {
    writeAuditJsonl([
      makeEvent('context7.query', 0),
      makeEvent('skill.loaded', 1),
      makeEvent('context7.query', 2),
    ]);

    const events = readAuditWindow(auditDir, { event: 'context7.query' });
    assert.strictEqual(events.length, 2);
    events.forEach(e => assert.strictEqual(e.event, 'context7.query'));
    teardown();
    setup();
  });

  it('Filter by sessionID', () => {
    writeAuditJsonl([
      { ...makeEvent('gating.started', 0), sessionID: 'session-A' },
      { ...makeEvent('gating.started', 1), sessionID: 'session-B' },
      { ...makeEvent('gating.started', 2), sessionID: 'session-A' },
    ]);

    const events = readAuditWindow(auditDir, { sessionID: 'session-A' });
    assert.strictEqual(events.length, 2);
    events.forEach(e => assert.strictEqual(e.sessionID, 'session-A'));
    teardown();
    setup();
  });

  it('Limit defaults to 1000', () => {
    const events = [];
    for (let i = 0; i < 1500; i++) {
      events.push(makeEvent('gating.started', 0));
    }
    writeAuditJsonl(events);

    const result = readAuditWindow(auditDir);
    assert.strictEqual(result.length, 1000);
    teardown();
    setup();
  });

  it('Events are returned newest first', () => {
    writeAuditJsonl([
      makeEvent('event-1', 30),
      makeEvent('event-2', 10),
      makeEvent('event-3', 0),
    ]);

    const events = readAuditWindow(auditDir, { windowMinutes: 60 });
    assert.strictEqual(events[0].event, 'event-3');
    assert.strictEqual(events[2].event, 'event-1');
    teardown();
    setup();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Archive Reader Tests — I-29 (archive does not authorize)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Archive Reader — I-29', () => {

  beforeEach(() => {
    setup();
  });

  after(() => {
    teardown();
  });

  it('Archive reader returns events, never ALLOW/DENY', () => {
    writeAuditJsonl([makeEvent('test-event', 0)]);
    rotate(auditDir);

    const archiveEvents = readArchiveEvents(auditDir);
    if (archiveEvents.length > 0) {
      assert.strictEqual(archiveEvents[0].decision, undefined);
      assert.strictEqual(archiveEvents[0].authorized, undefined);
    }
    teardown();
    setup();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Integration Tests — Windowed Reader + Rotation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Windowed Reader — Integration', () => {

  beforeEach(() => {
    setup();
  });

  after(() => {
    teardown();
  });

  it('Reader sees events after rotation', () => {
    writeAuditJsonl([makeEvent('before-rotation', 0)]);
    rotate(auditDir);

    writeAuditJsonl([makeEvent('after-rotation', 0)]);

    const events = readAuditWindow(auditDir);
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].event, 'after-rotation');
    teardown();
    setup();
  });

  it('Reader sees events across multiple rotations', () => {
    writeAuditJsonl([makeEvent('round-1', 0)]);
    rotate(auditDir);

    writeAuditJsonl([makeEvent('round-2', 0)]);
    rotate(auditDir);

    writeAuditJsonl([makeEvent('round-3', 0)]);

    const events = readAuditWindow(auditDir);
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].event, 'round-3');
    teardown();
    setup();
  });

  it('Rotation + Reader cycle preserves event order', () => {
    writeAuditJsonl([
      makeEvent('batch-1-a', 30),
      makeEvent('batch-1-b', 25),
      makeEvent('batch-1-c', 20),
    ]);
    rotate(auditDir);

    writeAuditJsonl([
      makeEvent('batch-2-a', 5),
      makeEvent('batch-2-b', 0),
    ]);

    const events = readAuditWindow(auditDir, { windowMinutes: 60 });
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].event, 'batch-2-b');
    assert.strictEqual(events[1].event, 'batch-2-a');
    teardown();
    setup();
  });
});
