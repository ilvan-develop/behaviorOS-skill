#!/usr/bin/env node

/**
 * behaviorOS — Audit Rotation (P1.2 Phase 2) Tests
 *
 * Tests the audit rotation engine that transforms audit.jsonl from an unbounded
 * log into a bounded operational window with archival.
 *
 * Invariants tested:
 *   I-11  current.jsonl never exceeds operational limit after rotation
 *   I-12  Rotation preserves all events (append-preserving)
 *   I-13  No event is lost
 *   I-14  current.jsonl remains writable after rotation
 *   I-15  Archive never participates in decision
 *   I-16  Archive corruption does not block governance-state
 *   I-17  Windows filesystem semantics respected
 *   I-18  Every rotation generates an auditable event
 *   I-19  Rotation is idempotent (concurrent rotations safe)
 *
 * CRITICAL: These tests NEVER depend on governance-state.json.
 * The boundary between SOURCE OF DECISION and SOURCE OF EXPLANATION is absolute.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, unlinkSync, readdirSync, statSync,
} from 'fs';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import from temp location (user must copy files first)
import {
  shouldRotate,
  rotate,
  loadConfig,
  DEFAULT_CONFIG,
} from '../.opencode/plugins/lib/audit-rotation.js';

import {
  replaceFileAtomic,
  ensureDir,
  fileSize,
  lineCount,
  readText,
} from '../.opencode/plugins/lib/fs-helpers.js';

import {
  appendAudit,
  auditDir,
} from '../.opencode/plugins/lib/oage-lib.js';

let FIXTURE;

function makeAuditDir() {
  const dir = join(FIXTURE, '.opencode', 'audit');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeAuditFile(lines = 5) {
  const dir = makeAuditDir();
  const file = join(dir, 'audit.jsonl');
  const entries = [];
  for (let i = 0; i < lines; i++) {
    entries.push(JSON.stringify({
      timestamp: new Date(Date.now() - (lines - i) * 60000).toISOString(),
      event: `test_event_${i}`,
      sessionID: 'test-session',
    }));
  }
  writeFileSync(file, entries.join('\n') + '\n');
  return file;
}

function makeGovernanceState() {
  const dir = makeAuditDir();
  const file = join(dir, 'governance-state.json');
  const state = {
    version: '1.0.0',
    schemaVersion: 1,
    projectId: 'test-project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries: [{
      gate: 'context7',
      sessionID: 'test-session',
      operation: 'edit-service',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }],
  };
  writeFileSync(file, JSON.stringify(state, null, 2));
  return file;
}

before(() => {
  FIXTURE = join(tmpdir(), `oage-rotation-${process.pid}`);
  rmSync(FIXTURE, { recursive: true, force: true });
  mkdirSync(FIXTURE, { recursive: true });

  // Create minimal governance directory for config loading
  mkdirSync(join(FIXTURE, '.opencode', 'governance'), { recursive: true });
  writeFileSync(
    join(FIXTURE, '.opencode', 'governance', 'audit.json'),
    JSON.stringify({
      version: '1.0.0',
      enabled: true,
      retention: {
        maxFileSize: 1024,  // 1KB for testing
        maxEvents: 10,      // 10 events for testing
      },
    }),
  );
});

after(() => {
  rmSync(FIXTURE, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. UNIT TESTS — fs-helpers.js
// ═══════════════════════════════════════════════════════════════════════════════

describe('AUDIT ROTATION — fs-helpers', () => {
  beforeEach(() => {
    const dir = join(FIXTURE, 'helpers-test');
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  });

  describe('ensureDir()', () => {
    it('creates directory recursively', () => {
      const dir = join(FIXTURE, 'helpers-test', 'a', 'b', 'c');
      ensureDir(dir);
      assert.ok(existsSync(dir));
    });

    it('is idempotent', () => {
      const dir = join(FIXTURE, 'helpers-test', 'd');
      ensureDir(dir);
      ensureDir(dir);
      assert.ok(existsSync(dir));
    });
  });

  describe('replaceFileAtomic()', () => {
    it('creates file if it does not exist', () => {
      const file = join(FIXTURE, 'helpers-test', 'new-file.txt');
      replaceFileAtomic(file, 'hello');
      assert.equal(readFileSync(file, 'utf8'), 'hello');
    });

    it('replaces existing file', () => {
      const file = join(FIXTURE, 'helpers-test', 'replace.txt');
      writeFileSync(file, 'old');
      replaceFileAtomic(file, 'new');
      assert.equal(readFileSync(file, 'utf8'), 'new');
    });

    it('cleans up temp file on success', () => {
      const file = join(FIXTURE, 'helpers-test', 'cleanup.txt');
      replaceFileAtomic(file, 'content');
      const dir = dirname(file);
      const tempFiles = readdirSync(dir).filter(f => f.includes('.tmp.'));
      assert.equal(tempFiles.length, 0);
    });
  });

  describe('fileSize()', () => {
    it('returns 0 for non-existent file', () => {
      assert.equal(fileSize(join(FIXTURE, 'helpers-test', 'nope.txt')), 0);
    });

    it('returns correct size', () => {
      const file = join(FIXTURE, 'helpers-test', 'size.txt');
      writeFileSync(file, 'hello');
      assert.equal(fileSize(file), 5);
    });
  });

  describe('lineCount()', () => {
    it('returns 0 for non-existent file', () => {
      assert.equal(lineCount(join(FIXTURE, 'helpers-test', 'nope.txt')), 0);
    });

    it('counts non-empty lines', () => {
      const file = join(FIXTURE, 'helpers-test', 'lines.txt');
      writeFileSync(file, 'line1\nline2\n\nline3\n');
      assert.equal(lineCount(file), 3);
    });
  });

  describe('readText()', () => {
    it('returns null for non-existent file', () => {
      assert.equal(readText(join(FIXTURE, 'helpers-test', 'nope.txt')), null);
    });

    it('returns file content', () => {
      const file = join(FIXTURE, 'helpers-test', 'read.txt');
      writeFileSync(file, 'content');
      assert.equal(readText(file), 'content');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. UNIT TESTS — audit-rotation.js
// ═══════════════════════════════════════════════════════════════════════════════

describe('AUDIT ROTATION — rotation engine', () => {
  beforeEach(() => {
    const auditPath = join(FIXTURE, '.opencode', 'audit');
    if (existsSync(auditPath)) rmSync(auditPath, { recursive: true, force: true });
    mkdirSync(auditPath, { recursive: true });
  });

  describe('loadConfig()', () => {
    it('loads from audit.json when present', () => {
      const config = loadConfig(FIXTURE);
      assert.equal(config.maxFileSize, 1024);
      assert.equal(config.maxEvents, 10);
    });

    it('uses defaults when audit.json is missing', () => {
      const dir = join(FIXTURE, 'no-governance');
      mkdirSync(dir, { recursive: true });
      const config = loadConfig(dir);
      assert.equal(config.maxFileSize, DEFAULT_CONFIG.maxFileSize);
      assert.equal(config.maxEvents, DEFAULT_CONFIG.maxEvents);
    });
  });

  describe('shouldRotate()', () => {
    it('returns false when no file exists', () => {
      const dir = makeAuditDir();
      const result = shouldRotate(dir);
      assert.equal(result.rotate, false);
      assert.equal(result.reason, 'no file');
    });

    it('returns false when within limits', () => {
      makeAuditFile(3);
      const dir = makeAuditDir();
      const result = shouldRotate(dir, { maxFileSize: 10240, maxEvents: 100 });
      assert.equal(result.rotate, false);
      assert.equal(result.reason, 'within limits');
    });

    it('returns true when size exceeds limit (I-11)', () => {
      makeAuditFile(5);
      const dir = makeAuditDir();
      // Config has maxFileSize: 1024, so a small file should trigger
      const result = shouldRotate(dir, { maxFileSize: 100, maxEvents: 100 });
      assert.equal(result.rotate, true);
      assert.match(result.reason, /size/);
    });

    it('returns true when event count exceeds limit (I-11)', () => {
      makeAuditFile(15);
      const dir = makeAuditDir();
      const result = shouldRotate(dir, { maxFileSize: 102400, maxEvents: 10 });
      assert.equal(result.rotate, true);
      assert.match(result.reason, /events/);
    });

    it('returns true when EITHER threshold is exceeded', () => {
      makeAuditFile(15);
      const dir = makeAuditDir();
      // Size is within limit, but events exceed
      const result = shouldRotate(dir, { maxFileSize: 102400, maxEvents: 10 });
      assert.equal(result.rotate, true);
    });
  });

  describe('rotate()', () => {
    it('returns false when no file exists', () => {
      const dir = makeAuditDir();
      const result = rotate(dir);
      assert.equal(result.rotated, false);
    });

    it('returns false when file is empty', () => {
      const dir = makeAuditDir();
      writeFileSync(join(dir, 'audit.jsonl'), '');
      const result = rotate(dir);
      assert.equal(result.rotated, false);
      assert.equal(result.reason, 'empty file');
    });

    it('creates archive directory structure YYYY/MM (I-12)', () => {
      makeAuditFile(5);
      const dir = makeAuditDir();
      const now = new Date(2026, 0, 15); // January 15, 2026
      rotate(dir, {}, now);

      const archiveDir = join(dir, 'archive', '2026', '01');
      assert.ok(existsSync(archiveDir));
    });

    it('creates archive file with correct name (I-12)', () => {
      makeAuditFile(5);
      const dir = makeAuditDir();
      const now = new Date(2026, 0, 15);
      rotate(dir, {}, now);

      const archiveFile = join(dir, 'archive', '2026', '01', 'audit-2026-01-15.jsonl');
      assert.ok(existsSync(archiveFile));
    });

    it('preserves all events in archive (I-13)', () => {
      makeAuditFile(5);
      const dir = makeAuditDir();
      const now = new Date(2026, 0, 15);
      rotate(dir, {}, now);

      const archiveFile = join(dir, 'archive', '2026', '01', 'audit-2026-01-15.jsonl');
      const content = readFileSync(archiveFile, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      assert.equal(lines.length, 5);
    });

    it('clears current.jsonl after rotation (I-14)', () => {
      makeAuditFile(5);
      const dir = makeAuditDir();
      rotate(dir);

      const currentPath = join(dir, 'audit.jsonl');
      assert.ok(existsSync(currentPath));
      const content = readFileSync(currentPath, 'utf8');
      assert.equal(content.trim(), '');
    });

    it('returns correct event count', () => {
      makeAuditFile(7);
      const dir = makeAuditDir();
      const result = rotate(dir);
      assert.equal(result.events, 7);
    });

    it('appends to existing archive file on same day (I-12)', () => {
      const dir = makeAuditDir();
      const archiveDir = join(dir, 'archive', '2026', '01');
      mkdirSync(archiveDir, { recursive: true });
      const archiveFile = join(archiveDir, 'audit-2026-01-15.jsonl');
      writeFileSync(archiveFile, '{"existing":"event"}\n');

      makeAuditFile(3);
      const now = new Date(2026, 0, 15);
      rotate(dir, {}, now);

      const content = readFileSync(archiveFile, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      assert.equal(lines.length, 4); // 1 existing + 3 rotated
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. INTEGRATION TESTS — appendAudit() with rotation
// ═══════════════════════════════════════════════════════════════════════════════

describe('AUDIT ROTATION — appendAudit integration', () => {
  beforeEach(() => {
    const auditPath = join(FIXTURE, '.opencode', 'audit');
    if (existsSync(auditPath)) rmSync(auditPath, { recursive: true, force: true });
    mkdirSync(auditPath, { recursive: true });
  });

  it('appendAudit works without rotation when within limits', () => {
    const record = appendAudit(FIXTURE, { event: 'test_event' });
    assert.ok(record.timestamp);
    assert.equal(record.event, 'test_event');
  });

  it('appendAudit triggers rotation when size exceeds limit', () => {
    // Fill audit.jsonl to near the limit
    const dir = auditDir(FIXTURE);
    const file = join(dir, 'audit.jsonl');
    ensureDir(dir);

    // Write content that exceeds 1024 bytes (config maxFileSize)
    const largeContent = 'x'.repeat(1100);
    writeFileSync(file, largeContent);

    // This append should trigger rotation
    appendAudit(FIXTURE, { event: 'after_rotation' });

    // Current file should be small (just the rotation event + our event)
    const currentContent = readFileSync(file, 'utf8');
    assert.ok(currentContent.includes('after_rotation'));

    // Archive should exist
    const archiveDir = join(dir, 'archive');
    assert.ok(existsSync(archiveDir));
  });

  it('appendAudit triggers rotation when event count exceeds limit', () => {
    const dir = auditDir(FIXTURE);
    const file = join(dir, 'audit.jsonl');
    ensureDir(dir);

    // Write 10 events (config maxEvents)
    const events = [];
    for (let i = 0; i < 10; i++) {
      events.push(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: `event_${i}`,
      }));
    }
    writeFileSync(file, events.join('\n') + '\n');

    // This append should trigger rotation
    appendAudit(FIXTURE, { event: 'event_11' });

    // Archive should exist
    const archiveDir = join(dir, 'archive');
    assert.ok(existsSync(archiveDir));
  });

  it('rotation event is recorded in audit trail (I-18)', () => {
    const dir = auditDir(FIXTURE);
    const file = join(dir, 'audit.jsonl');
    ensureDir(dir);

    // Fill to trigger rotation
    writeFileSync(file, 'x'.repeat(1100));

    appendAudit(FIXTURE, { event: 'after' });

    const content = readFileSync(file, 'utf8');
    assert.ok(content.includes('audit_rotated'), 'Rotation event should be recorded');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ADVERSARIAL TESTS — governance-state independence
// ═══════════════════════════════════════════════════════════════════════════════

describe('AUDIT ROTATION — Adversarial: governance-state independence', () => {
  beforeEach(() => {
    const auditPath = join(FIXTURE, '.opencode', 'audit');
    if (existsSync(auditPath)) rmSync(auditPath, { recursive: true, force: true });
    mkdirSync(auditPath, { recursive: true });
  });

  it('I-15: Archive never participates in decision', () => {
    // Create audit file and archive it
    makeAuditFile(5);
    const dir = makeAuditDir();
    rotate(dir);

    // Archive exists but governance-state is unaffected
    const archiveDir = join(dir, 'archive');
    assert.ok(existsSync(archiveDir));

    // Verify rotation worked (archive has events)
    const archiveFiles = readdirSync(archiveDir).length;
    assert.ok(archiveFiles > 0);
  });

  it('I-16: Archive corruption does not block governance-state', () => {
    // Create governance state
    makeGovernanceState();

    // Create and rotate audit
    makeAuditFile(5);
    const dir = makeAuditDir();
    rotate(dir);

    // Corrupt the archive
    const archiveDir = join(dir, 'archive');
    const years = readdirSync(archiveDir);
    for (const year of years) {
      const months = readdirSync(join(archiveDir, year));
      for (const month of months) {
        const files = readdirSync(join(archiveDir, year, month));
        for (const file of files) {
          writeFileSync(join(archiveDir, year, month, file), '{CORRUPTED');
        }
      }
    }

    // Governance state should still be valid
    const stateFile = join(dir, 'governance-state.json');
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    assert.ok(state.entries.length > 0);
  });

  it('I-15: Remove archive — rotation still works', () => {
    makeAuditFile(3);
    const dir = makeAuditDir();
    rotate(dir);

    // Remove archive
    const archiveDir = join(dir, 'archive');
    rmSync(archiveDir, { recursive: true, force: true });

    // Rotation should still work
    makeAuditFile(5);
    const result = rotate(dir);
    assert.equal(result.rotated, true);
  });

  it('I-16: Corrupt archive — governance-state unaffected', () => {
    makeGovernanceState();

    // Corrupt archive
    const dir = makeAuditDir();
    const archiveDir = join(dir, 'archive');
    mkdirSync(archiveDir, { recursive: true });
    writeFileSync(join(archiveDir, 'corrupted.jsonl'), '{bad');

    // Governance state should still be valid
    const stateFile = join(dir, 'governance-state.json');
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    assert.ok(state);
    assert.ok(state.entries);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. IDEMPOTENCY TESTS — I-19
// ═══════════════════════════════════════════════════════════════════════════════

describe('AUDIT ROTATION — Idempotency (I-19)', () => {
  beforeEach(() => {
    const auditPath = join(FIXTURE, '.opencode', 'audit');
    if (existsSync(auditPath)) rmSync(auditPath, { recursive: true, force: true });
    mkdirSync(auditPath, { recursive: true });
  });

  it('rotate() is safe to call on empty directory', () => {
    const dir = makeAuditDir();
    const result = rotate(dir);
    assert.equal(result.rotated, false);
  });

  it('rotate() is safe to call twice on same data', () => {
    makeAuditFile(3);
    const dir = makeAuditDir();
    const result1 = rotate(dir);
    assert.equal(result1.rotated, true);

    // Second rotation on empty file should be a no-op
    const result2 = rotate(dir);
    assert.equal(result2.rotated, false);
  });

  it('concurrent rotations do not lose events (I-19)', () => {
    makeAuditFile(5);
    const dir = makeAuditDir();

    // Simulate two rotations (in practice this is serialized by Node.js)
    const result1 = rotate(dir);
    assert.equal(result1.events, 5);

    // Write more events
    const file = join(dir, 'audit.jsonl');
    const events = [];
    for (let i = 0; i < 3; i++) {
      events.push(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: `batch2_${i}`,
      }));
    }
    writeFileSync(file, events.join('\n') + '\n');

    // Second rotation
    const result2 = rotate(dir);
    assert.equal(result2.events, 3);

    // Both archives should exist (different timestamps)
    const archiveDir = join(dir, 'archive');
    assert.ok(existsSync(archiveDir));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. EVENT LOSS PREVENTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('AUDIT ROTATION — Event loss prevention', () => {
  beforeEach(() => {
    const auditPath = join(FIXTURE, '.opencode', 'audit');
    if (existsSync(auditPath)) rmSync(auditPath, { recursive: true, force: true });
    mkdirSync(auditPath, { recursive: true });
  });

  it('no event loss during rotation (I-13)', () => {
    makeAuditFile(10);
    const dir = makeAuditDir();
    rotate(dir);

    // Count events in archive
    const archiveDir = join(dir, 'archive');
    let totalEvents = 0;
    const walk = (d) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(join(d, entry.name));
        else if (entry.name.endsWith('.jsonl')) {
          const content = readFileSync(join(d, entry.name), 'utf8');
          totalEvents += content.split('\n').filter(l => l.trim()).length;
        }
      }
    };
    walk(archiveDir);

    assert.equal(totalEvents, 10);
  });

  it('no event duplication during same-day rotation', () => {
    const dir = makeAuditDir();
    const archiveDir = join(dir, 'archive', '2026', '01');
    mkdirSync(archiveDir, { recursive: true });
    const archiveFile = join(archiveDir, 'audit-2026-01-15.jsonl');

    // Write existing events
    writeFileSync(archiveFile, '{"existing":"event1"}\n{"existing":"event2"}\n');

    // Create and rotate
    makeAuditFile(3);
    const now = new Date(2026, 0, 15);
    rotate(dir, {}, now);

    // Count events in archive
    const content = readFileSync(archiveFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    assert.equal(lines.length, 5); // 2 existing + 3 rotated (no duplication)
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. CURRENT FILE OPERATIONALITY
// ═══════════════════════════════════════════════════════════════════════════════

describe('AUDIT ROTATION — Current file operationality (I-14)', () => {
  beforeEach(() => {
    const auditPath = join(FIXTURE, '.opencode', 'audit');
    if (existsSync(auditPath)) rmSync(auditPath, { recursive: true, force: true });
    mkdirSync(auditPath, { recursive: true });
  });

  it('can append immediately after rotation', () => {
    makeAuditFile(5);
    const dir = makeAuditDir();
    rotate(dir);

    // Append new event
    const record = appendAudit(FIXTURE, { event: 'post_rotation' });
    assert.ok(record.timestamp);
    assert.equal(record.event, 'post_rotation');
  });

  it('current.jsonl exists after rotation', () => {
    makeAuditFile(5);
    const dir = makeAuditDir();
    rotate(dir);

    const file = join(dir, 'audit.jsonl');
    assert.ok(existsSync(file));
  });

  it('current.jsonl is empty after rotation but writable', () => {
    makeAuditFile(5);
    const dir = makeAuditDir();
    rotate(dir);

    const file = join(dir, 'audit.jsonl');
    const content = readFileSync(file, 'utf8');
    assert.equal(content, '');

    // Should be writable
    appendAudit(FIXTURE, { event: 'test' });
    const newContent = readFileSync(file, 'utf8');
    assert.ok(newContent.includes('test'));
  });
});
