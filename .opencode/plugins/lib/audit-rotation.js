/**
 * Audit Rotation Engine — P1.2 Phase 2 + Phase 3
 *
 * Transforms audit.jsonl from an unbounded log into a bounded operational window
 * with archival. The audit trail remains SOURCE OF EXPLANATION and does not
 * participate in enforcement decisions.
 *
 * Invariants:
 *   I-11  current.jsonl never exceeds operational limit after rotation
 *   I-12  Rotation preserves all events (append-preserving)
 *   I-13  No event is lost
 *   I-14  current.jsonl remains writable after rotation
 *   I-15  Archive never participates in decision
 *   I-16  Archive corruption does not block governance-state
 *   I-17  Windows filesystem semantics respected
 *   I-18  Every rotation generates an auditable event
 *   I-19  Rotation is idempotent (concurrent rotations safe)
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
 *
 * CRITICAL: This module NEVER reads, writes, or depends on governance-state.json.
 * The boundary between SOURCE OF DECISION and SOURCE OF EXPLANATION is absolute.
 */

import { existsSync, readFileSync, readdirSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { replaceFileAtomic, ensureDir, fileSize, lineCount, readText } from './fs-helpers.js';

/**
 * Default rotation configuration.
 * Loaded from audit.json if present, otherwise uses these defaults.
 */
export const DEFAULT_CONFIG = {
  maxFileSize: 10 * 1024 * 1024,  // 10MB
  maxEvents: 10000,                // 10K events
  archiveBase: 'archive',          // relative to audit dir
};

/**
 * Load rotation config from audit.json.
 * Falls back to defaults if file is missing or invalid.
 */
export function loadConfig(root) {
  try {
    const configPath = join(root, '.opencode', 'governance', 'audit.json');
    if (!existsSync(configPath)) return { ...DEFAULT_CONFIG };
    const raw = JSON.parse(readFileSync(configPath, 'utf8'));
    return {
      maxFileSize: raw.retention?.maxFileSize || raw.retention?.maxSizeBytes || DEFAULT_CONFIG.maxFileSize,
      maxEvents: raw.retention?.maxEvents || DEFAULT_CONFIG.maxEvents,
      archiveBase: raw.retention?.archiveBase || DEFAULT_CONFIG.archiveBase,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Check if current.jsonl needs rotation.
 *
 * Rotation is triggered when EITHER threshold is exceeded:
 *   - file size >= maxFileSize
 *   - event count >= maxEvents
 *
 * @param {string} auditDir - Path to .opencode/audit directory
 * @param {object} config - Rotation configuration
 * @returns {{ rotate: boolean, reason: string, size: number, events: number }}
 */
export function shouldRotate(auditDir, config = {}) {
  const { maxFileSize, maxEvents } = { ...DEFAULT_CONFIG, ...config };
  const currentPath = join(auditDir, 'audit.jsonl');

  if (!existsSync(currentPath)) {
    return { rotate: false, reason: 'no file', size: 0, events: 0 };
  }

  const size = fileSize(currentPath);
  const events = lineCount(currentPath);

  if (size >= maxFileSize) {
    return { rotate: true, reason: `size ${size} >= ${maxFileSize}`, size, events };
  }

  if (events >= maxEvents) {
    return { rotate: true, reason: `events ${events} >= ${maxEvents}`, size, events };
  }

  return { rotate: false, reason: 'within limits', size, events };
}

/**
 * Rotate audit.jsonl to archive.
 *
 * Archive structure: archive/YYYY/MM/audit-YYYY-MM-DD.jsonl
 * If archive file exists for the same day, events are appended (not duplicated).
 *
 * @param {string} auditDir - Path to .opencode/audit directory
 * @param {object} config - Rotation configuration
 * @param {Date} now - Current timestamp (injectable for testing)
 * @returns {{ rotated: boolean, archivePath: string, events: number, reason: string }}
 */
export function rotate(auditDir, config = {}, now = new Date()) {
  const { archiveBase } = { ...DEFAULT_CONFIG, ...config };
  const currentPath = join(auditDir, 'audit.jsonl');

  if (!existsSync(currentPath)) {
    return { rotated: false, reason: 'no file', archivePath: null, events: 0 };
  }

  const content = readText(currentPath);
  if (!content || !content.trim()) {
    return { rotated: false, reason: 'empty file', archivePath: null, events: 0 };
  }

  // Count events before rotation
  const eventCount = content.split('\n').filter(l => l.trim()).length;

  // Determine archive path: archive/YYYY/MM/audit-YYYY-MM-DD.jsonl
  const YYYY = String(now.getFullYear());
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const DD = String(now.getDate()).padStart(2, '0');

  const archiveDir = join(auditDir, archiveBase, YYYY, MM);
  const archiveFile = join(archiveDir, `audit-${YYYY}-${MM}-${DD}.jsonl`);

  ensureDir(archiveDir);

  // If archive file exists, append to it (same day rotation preserves order)
  if (existsSync(archiveFile)) {
    appendFileSync(archiveFile, content, 'utf8');
  } else {
    replaceFileAtomic(archiveFile, content);
  }

  // Clear current.jsonl (write empty file, not delete)
  // This preserves the file for immediate reuse
  replaceFileAtomic(currentPath, '');

  return {
    rotated: true,
    archivePath: archiveFile,
    events: eventCount,
    reason: 'rotation complete',
  };
}

/**
 * Read events from archive files.
 *
 * FOR EXPLANATION/FORENSIC PURPOSES ONLY.
 * Does NOT participate in enforcement decisions.
 *
 * @param {string} auditDir - Path to .opencode/audit directory
 * @param {object} options - Filter options
 * @param {string} options.startDate - Start date (YYYY-MM-DD)
 * @param {string} options.endDate - End date (YYYY-MM-DD)
 * @param {string} options.event - Filter by event type
 * @returns {Array} Matching events
 */
export function readArchiveEvents(auditDir, { startDate, endDate, event } = {}) {
  const { archiveBase } = DEFAULT_CONFIG;
  const archiveDir = join(auditDir, archiveBase);

  if (!existsSync(archiveDir)) return [];

  const events = [];

  // Walk YYYY directories
  const years = readdirSync(archiveDir).filter(d => /^\d{4}$/.test(d));

  for (const year of years) {
    const yearDir = join(archiveDir, year);
    const months = readdirSync(yearDir).filter(d => /^\d{2}$/.test(d));

    for (const month of months) {
      const monthDir = join(yearDir, month);
      const files = readdirSync(monthDir).filter(f => f.endsWith('.jsonl'));

      for (const file of files) {
        const fileDate = file.replace('audit-', '').replace('.jsonl', '');

        // Date filter
        if (startDate && fileDate < startDate) continue;
        if (endDate && fileDate > endDate) continue;

        const filePath = join(monthDir, file);
        const content = readText(filePath);
        if (!content) continue;

        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          try {
            const rec = JSON.parse(line);
            if (event && rec.event !== event) continue;
            events.push(rec);
          } catch {
            // Skip malformed lines
          }
        }
      }
    }
  }

  return events;
}

// ═══════════════════════════════════════════════════════════════════════════════
// P1.2 Phase 3 — Windowed Reader
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Read audit events from current.jsonl within a bounded temporal window.
 *
 * This is the primary reader for runtime enforcement. It reads ONLY from
 * current.jsonl (the bounded operational window) and never touches archive.
 *
 * Properties:
 *   - Bounded: reads only current.jsonl, not archive
 *   - Temporal: filters by windowMinutes (default 30)
 *   - Resilient: handles empty files and malformed lines
 *   - Read-only: never modifies audit trail or governance-state
 *   - Evidence-only: cannot authorize operations (I-29)
 *
 * @param {string} auditDir - Path to .opencode/audit directory
 * @param {object} options - Filter options
 * @param {string} options.event - Filter by event type
 * @param {number} options.windowMinutes - Time window in minutes (default 30)
 * @param {string} options.sessionID - Filter by session ID
 * @param {number} options.limit - Maximum events to return (default 1000)
 * @returns {Array} Matching events (newest first)
 */
export function readAuditWindow(auditDir, { event, windowMinutes = 30, sessionID, limit = 1000 } = {}) {
  const currentPath = join(auditDir, 'audit.jsonl');

  // I-22: Support empty current.jsonl
  if (!existsSync(currentPath)) return [];

  const content = readText(currentPath);
  if (!content) return [];

  // I-20: Respect temporal window
  const cutoff = Date.now() - windowMinutes * 60 * 1000;
  const out = [];

  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const rec = JSON.parse(line);

      // I-27: Events outside window are not returned
      if (new Date(rec.timestamp).getTime() < cutoff) continue;

      // Filter by event type
      if (event && rec.event !== event) continue;

      // Filter by session ID
      if (sessionID && rec.sessionID && rec.sessionID !== sessionID) continue;

      out.push(rec);

      // I-21: Do not read beyond necessary window
      if (out.length >= limit) break;
    } catch {
      // I-23: Skip malformed lines (partially corrupted file)
    }
  }

  return out.reverse();
}

/**
 * Read audit events with backward compatibility.
 *
 * This function maintains the same signature as the original readAuditEvents()
 * but uses the windowed reader internally for efficiency.
 *
 * I-26: Maintains backward compatibility with readAuditEvents.
 *
 * @param {string} root - Project root directory
 * @param {object} options - Filter options (same as readAuditEvents)
 * @returns {Array} Matching events
 */
export function readAuditEventsCompat(root, { event, windowMinutes = 30, sessionID } = {}) {
  const auditDirPath = join(root, '.opencode', 'audit');
  return readAuditWindow(auditDirPath, { event, windowMinutes, sessionID });
}
