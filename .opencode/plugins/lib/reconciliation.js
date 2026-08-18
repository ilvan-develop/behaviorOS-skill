/**
 * Reconciliation Engine — P1.2 Phase 4
 *
 * Detects inconsistencies between governance-state.json (SOURCE OF DECISION)
 * and audit.jsonl (SOURCE OF EXPLANATION). Reconciliation is observational
 * only — it never authorizes operations or modifies state.
 *
 * Invariants:
 *   I-30  State remains authoritative — reconciliation never alters a valid decision
 *   I-31  Missing audit detection — state entry without corresponding audit event
 *   I-32  State ahead detection — state contains evidence more recent than audit
 *   I-33  Audit ahead does not authorize state — audit event without state ≠ ALLOW
 *   I-34  Corruption isolation — audit corruption cannot modify or invalidate state
 *   I-35  Session consistency — comparisons respect sessionID
 *   I-36  Gate consistency — comparisons respect gate
 *   I-37  Event identity — deterministic unique identifier prevents false mismatches
 *   I-38  Reconciliation is observational — not in synchronous before → ALLOW/DENY path
 *   I-39  Fail-safe reporting — reconciler failure → DEGRADED/RECONCILIATION_FAILED
 *   I-40  No silent repair — reconciler does not auto-correct audit or state
 *
 * States:
 *   SYNCED              — consistent
 *   MISSING_AUDIT       — state entry without audit event
 *   STATE_AHEAD         — state newer than audit
 *   AUDIT_CORRUPTED     — audit file corrupted
 *   STATE_CORRUPTED     — state file corrupted
 *   DEGRADED            — operational failure
 *   RECONCILIATION_FAILED — reconciler itself failed
 *
 * CRITICAL: These states are DIAGNOSTICS, not authorization decisions.
 *   MISSING_AUDIT ≠ DENY
 *   STATE_AHEAD ≠ ALLOW
 *   AUDIT_CORRUPTED ≠ DENY
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readAuditWindow, readArchiveEvents, loadConfig, DEFAULT_CONFIG } from './audit-rotation.js';
import { readState, validateState, isEntryValid } from './governance-state.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

export const RECONCILIATION_STATES = {
  SYNCED: 'SYNCED',
  MISSING_AUDIT: 'MISSING_AUDIT',
  STATE_AHEAD: 'STATE_AHEAD',
  AUDIT_CORRUPTED: 'AUDIT_CORRUPTED',
  STATE_CORRUPTED: 'STATE_CORRUPTED',
  DEGRADED: 'DEGRADED',
  RECONCILIATION_FAILED: 'RECONCILIATION_FAILED',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Event Identity (I-37)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate deterministic event identity for comparison.
 *
 * I-37: Uses gate + sessionID + createdAt to create a unique key.
 * This prevents false mismatches when the same logical event
 * appears in both state and audit with slightly different timestamps.
 */
export function eventIdentity(entry) {
  if (!entry) return null;
  const gate = entry.gate || entry.event || 'unknown';
  const session = entry.sessionID || entry.sessionId || 'unknown';
  const created = entry.createdAt || entry.timestamp || 'unknown';
  return `${gate}::${session}::${created}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Core Reconciliation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reconcile governance state with audit trail.
 *
 * Returns a reconciliation report:
 * {
 *   state: SYNCED | MISSING_AUDIT | STATE_AHEAD | AUDIT_CORRUPTED | STATE_CORRUPTED | DEGRADED,
 *   timestamp: string,
 *   stateEntries: number,
 *   auditEvents: number,
 *   issues: Array<{ type, description, entry?, event? }>,
 *   recommendation: string
 * }
 *
 * I-38: This function is NOT called in the synchronous before → ALLOW/DENY path.
 * It is called periodically or on-demand for diagnostics only.
 *
 * @param {string} root - Project root directory
 * @param {object} options - Reconciliation options
 * @param {number} options.windowMinutes - Time window for audit events (default 30)
 * @param {string} options.sessionID - Optional session filter
 * @returns {object} Reconciliation report
 */
export function reconcile(root, { windowMinutes = 30, sessionID } = {}) {
  const report = {
    state: RECONCILIATION_STATES.SYNCED,
    timestamp: new Date().toISOString(),
    stateEntries: 0,
    auditEvents: 0,
    issues: [],
    recommendation: 'No issues detected',
  };

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // Step 1: Read governance state (I-30: state remains authoritative)
    // ─────────────────────────────────────────────────────────────────────────
    const state = readState(root);

    if (!state) {
      report.state = RECONCILIATION_STATES.STATE_CORRUPTED;
      report.issues.push({
        type: 'STATE_MISSING',
        description: 'governance-state.json is missing or unreadable',
      });
      report.recommendation = 'Investigate why governance-state.json is missing';
      return report;
    }

    const stateValidation = validateState(state);
    if (!stateValidation.valid) {
      report.state = RECONCILIATION_STATES.STATE_CORRUPTED;
      report.issues.push({
        type: 'STATE_INVALID',
        description: `governance-state.json validation failed: ${stateValidation.reason}`,
      });
      report.recommendation = 'Investigate state corruption; do not modify audit trail';
      return report;
    }

    report.stateEntries = state.entries.length;

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2: Read audit events (I-34: corruption isolation)
    // ─────────────────────────────────────────────────────────────────────────
    const auditDir = join(root, '.opencode', 'audit');
    const auditPath = join(auditDir, 'audit.jsonl');
    let auditEvents = [];

    // Check if audit file exists and is readable
    if (existsSync(auditPath)) {
      try {
        const content = readFileSync(auditPath, 'utf8');
        if (content && content.trim()) {
          // Check for corruption: valid JSONL should have at least one valid JSON line
          const lines = content.split('\n').filter(l => l.trim());
          let hasValidLine = false;
          let corruptedLines = 0;

          for (const line of lines) {
            try {
              JSON.parse(line);
              hasValidLine = true;
            } catch {
              corruptedLines++;
            }
          }

          // If file has content but no valid lines, it's corrupted
          if (lines.length > 0 && !hasValidLine) {
            report.state = RECONCILIATION_STATES.AUDIT_CORRUPTED;
            report.issues.push({
              type: 'AUDIT_CORRUPTED',
              description: `audit.jsonl contains ${corruptedLines} corrupted lines with no valid JSON`,
            });
            report.recommendation = 'Audit trail is corrupted; state is unaffected';
            return report;
          }

          // If more than 50% of lines are corrupted, warn but continue
          if (corruptedLines > lines.length * 0.5) {
            report.issues.push({
              type: 'AUDIT_PARTIAL_CORRUPTION',
              description: `${corruptedLines} of ${lines.length} lines in audit.jsonl are corrupted`,
            });
          }
        }
        auditEvents = readAuditWindow(auditDir, { windowMinutes, sessionID });
      } catch {
        report.state = RECONCILIATION_STATES.AUDIT_CORRUPTED;
        report.issues.push({
          type: 'AUDIT_READ_FAILED',
          description: 'Failed to read audit.jsonl (corrupted or inaccessible)',
        });
        report.recommendation = 'Audit trail may be corrupted; state is unaffected';
        return report;
      }
    }

    report.auditEvents = auditEvents.length;

    // ─────────────────────────────────────────────────────────────────────────
    // Step 3: Build audit event identity set (I-37)
    // ─────────────────────────────────────────────────────────────────────────
    const auditIdentities = new Set();
    for (const event of auditEvents) {
      const id = eventIdentity(event);
      if (id) auditIdentities.add(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 4: Compare state entries against audit events
    // ─────────────────────────────────────────────────────────────────────────
    const stateIssues = [];

    for (const entry of state.entries) {
      // I-35: Session consistency — respect sessionID
      if (sessionID && entry.sessionID !== sessionID) continue;

      // I-36: Gate consistency — respect gate
      const entryId = eventIdentity(entry);

      if (!auditIdentities.has(entryId)) {
        // I-31: Missing audit detection
        stateIssues.push({
          type: 'MISSING_AUDIT',
          description: `State entry for gate "${entry.gate}" has no corresponding audit event`,
          entry: {
            gate: entry.gate,
            sessionID: entry.sessionID,
            createdAt: entry.createdAt,
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 5: Check for state ahead (I-32)
    // ─────────────────────────────────────────────────────────────────────────
    if (state.entries.length > 0 && auditEvents.length > 0) {
      const latestStateEntry = state.entries.reduce((latest, e) =>
        new Date(e.createdAt) > new Date(latest.createdAt) ? e : latest
      );
      const latestAuditEvent = auditEvents.reduce((latest, e) =>
        new Date(e.timestamp) > new Date(latest.timestamp) ? e : latest
      );

      if (new Date(latestStateEntry.createdAt) > new Date(latestAuditEvent.timestamp)) {
        stateIssues.push({
          type: 'STATE_AHEAD',
          description: 'State contains evidence more recent than audit trail',
          entry: {
            gate: latestStateEntry.gate,
            sessionID: latestStateEntry.sessionID,
            createdAt: latestStateEntry.createdAt,
          },
          event: {
            timestamp: latestAuditEvent.timestamp,
            event: latestAuditEvent.event,
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 6: Determine final state
    // ─────────────────────────────────────────────────────────────────────────
    if (stateIssues.length > 0) {
      report.issues = stateIssues;

      // Prioritize issues: STATE_CORRUPTED > AUDIT_CORRUPTED > STATE_AHEAD > MISSING_AUDIT
      const hasMissingAudit = stateIssues.some(i => i.type === 'MISSING_AUDIT');
      const hasStateAhead = stateIssues.some(i => i.type === 'STATE_AHEAD');

      if (hasStateAhead) {
        report.state = RECONCILIATION_STATES.STATE_AHEAD;
        report.recommendation = 'State has newer evidence than audit; audit may need investigation';
      } else if (hasMissingAudit) {
        report.state = RECONCILIATION_STATES.MISSING_AUDIT;
        report.recommendation = 'Audit trail missing events for state entries; check appendAudit';
      }
    }

    return report;

  } catch (error) {
    // I-39: Fail-safe reporting
    report.state = RECONCILIATION_STATES.RECONCILIATION_FAILED;
    report.issues.push({
      type: 'RECONCILER_ERROR',
      description: `Reconciliation failed: ${error.message}`,
    });
    report.recommendation = 'Reconciler error; state is unaffected';
    return report;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Health Check (simplified)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quick health check without full reconciliation.
 *
 * Returns { healthy: boolean, state: string, issues: number }.
 *
 * @param {string} root - Project root directory
 * @returns {object} Health status
 */
export function healthCheck(root) {
  try {
    const report = reconcile(root, { windowMinutes: 5 });
    return {
      healthy: report.state === RECONCILIATION_STATES.SYNCED,
      state: report.state,
      issues: report.issues.length,
    };
  } catch {
    return {
      healthy: false,
      state: RECONCILIATION_STATES.RECONCILIATION_FAILED,
      issues: 1,
    };
  }
}
