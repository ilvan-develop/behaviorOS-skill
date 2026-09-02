/**
 * behaviorOS — Governance State (P1.2)
 *
 * Operational state for enforcement decisions. The SOURCE OF DECISION for gates
 * that depend on recent evidence (Context7, Truth, Skill, Knowledge).
 *
 * Architecture:
 *   governance-state.json  ← SOURCE OF DECISION (TTL-based, session-scoped)
 *   audit.jsonl            ← SOURCE OF EXPLANATION (append-only, historical)
 *
 * These two receive the SAME event but remain INDEPENDENT. The audit trail
 * records what happened. The governance state maintains what is needed to decide.
 *
 * Invariants:
 *   I-01: TTL mandatory — every entry has expiresAt = createdAt + ttlMinutes[gate]
 *   I-02: Session associated — every entry has a valid sessionID
 *   I-03: No expiration reuse — expired state NEVER results in ALLOW
 *   I-04: Atomic writes — write-to-temp + rename
 *   I-05: Schema versioned — incompatible schema → discard, not migrate
 *   I-06: Fail-closed — invalid/missing/corrupt state → DENY
 *   I-07: Audit of update — every state write generates audit event
 *   I-08: Never replace audit — audit corruption does NOT replace governance state
 *   I-09: Max entries — LRU eviction when maxEntries exceeded
 *   I-10: Append-only semantics — entries are appended, never edited in-place
 */

import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const GOVERNANCE_STATE_VERSION = 1;

const STATE_FILE = 'governance-state.json';

// ─────────────────────────────────────────────────────────────────────────────
// Path helpers
// ─────────────────────────────────────────────────────────────────────────────

function auditDir(root) {
  return join(root, '.opencode', 'audit');
}

function statePath(root) {
  return join(auditDir(root), STATE_FILE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read governance state from disk. Returns null if file is missing or corrupt.
 *
 * DOES NOT validate schema — caller must use validateState() for that.
 * This separation exists so corrupt state can be detected and reported
 * without this function throwing (which would mask the corruption reason).
 */
export function readState(root) {
  const path = statePath(root);
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null; // corrupt JSON
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate governance state structure. Pure function — no I/O.
 *
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function validateState(state) {
  if (!state || typeof state !== 'object') {
    return { valid: false, reason: 'State is null or not an object' };
  }

  if (state.schemaVersion !== GOVERNANCE_STATE_VERSION) {
    return {
      valid: false,
      reason: `Schema version mismatch: expected ${GOVERNANCE_STATE_VERSION}, got ${state.schemaVersion}`,
    };
  }

  if (typeof state.projectId !== 'string' || !state.projectId) {
    return { valid: false, reason: 'Missing or invalid projectId' };
  }

  if (!Array.isArray(state.entries)) {
    return { valid: false, reason: 'Missing or invalid entries array' };
  }

  for (const entry of state.entries) {
    if (!entry.gate || typeof entry.gate !== 'string') {
      return { valid: false, reason: 'Entry missing valid gate field' };
    }
    if (!entry.sessionID || typeof entry.sessionID !== 'string') {
      return { valid: false, reason: `Entry for gate "${entry.gate}" missing valid sessionID` };
    }
    if (!entry.createdAt || typeof entry.createdAt !== 'string') {
      return { valid: false, reason: `Entry for gate "${entry.gate}" missing valid createdAt` };
    }
    if (!entry.expiresAt || typeof entry.expiresAt !== 'string') {
      return { valid: false, reason: `Entry for gate "${entry.gate}" missing valid expiresAt` };
    }

    // Verify expiresAt > createdAt
    const created = new Date(entry.createdAt).getTime();
    const expires = new Date(entry.expiresAt).getTime();
    if (isNaN(created) || isNaN(expires) || expires <= created) {
      return {
        valid: false,
        reason: `Entry for gate "${entry.gate}" has expiresAt <= createdAt`,
      };
    }
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Write (atomic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write governance state atomically (write-to-temp + rename).
 *
 * On Windows, renameSync fails if destination exists. Using a unique temp name
 * and then replacing is the safest cross-platform approach. On POSIX, renameSync
 * is atomic even when destination exists.
 */
export function writeState(root, state) {
  const dir = auditDir(root);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const path = statePath(root);
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;

  // 1. Validate before writing
  const { valid, reason } = validateState(state);
  if (!valid) {
    throw new Error(`[OAGE] Governance state validation failed: ${reason}`);
  }

  // 2. Serialize
  const content = JSON.stringify(state, null, 2);

  // 3. Write to temp file
  writeFileSync(tmp, content, 'utf8');

  // 4. Validate what was written (roundtrip check)
  try {
    const parsed = JSON.parse(readFileSync(tmp, 'utf8'));
    const recheck = validateState(parsed);
    if (!recheck.valid) {
      unlinkSync(tmp);
      throw new Error(`[OAGE] Roundtrip validation failed: ${recheck.reason}`);
    }
  } catch (e) {
    if (existsSync(tmp)) unlinkSync(tmp);
    throw e;
  }

  // 5. Replace destination
  try {
    if (existsSync(path)) {
      unlinkSync(path);
    }
    renameSync(tmp, path);
  } catch {
    // Windows fallback: if rename fails, try direct write
    if (existsSync(tmp)) unlinkSync(tmp);
    writeFileSync(path, content, 'utf8');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TTL & expiration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default TTL minutes per gate type.
 */
export const DEFAULT_TTL = {
  context7: 30,
  truth: 30,
  skill: 240,
  knowledge: 240,
};

/**
 * Check if an entry is currently valid (not expired).
 */
export function isEntryValid(entry) {
  if (!entry || !entry.expiresAt) return false;
  try {
    return Date.now() < new Date(entry.expiresAt).getTime();
  } catch {
    return false;
  }
}

/**
 * Prune expired entries from state. Returns new state object.
 */
export function pruneExpired(state) {
  if (!state || !state.entries) return state;

  return {
    ...state,
    entries: state.entries.filter(isEntryValid),
    updatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new governance state object.
 */
export function createState(root, projectId) {
  return {
    version: '1.0.0',
    schemaVersion: GOVERNANCE_STATE_VERSION,
    projectId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries: [],
  };
}

/**
 * Add an entry to governance state. Handles TTL, pruning, and LRU eviction.
 *
 * Returns the updated state (caller must persist via writeState).
 */
export function addEntry(state, { gate, sessionID, operation, query, confidence, source, ttlMinutes }) {
  const now = new Date();
  const ttl = ttlMinutes || DEFAULT_TTL[gate] || 30;
  const expiresAt = new Date(now.getTime() + ttl * 60 * 1000);

  const entry = {
    gate,
    sessionID: sessionID || 'unknown',
    operation: operation || 'unknown',
    query: query || null,
    confidence: confidence ?? null,
    source: source || null,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  // Add entry
  const entries = [...(state.entries || []), entry];

  // Prune expired
  const validEntries = entries.filter(isEntryValid);

  // LRU eviction: keep most recent maxEntries
  const maxEntries = state.maxEntries || 500;
  const trimmed = validEntries.length > maxEntries
    ? validEntries.slice(-maxEntries)
    : validEntries;

  return {
    ...state,
    entries: trimmed,
    updatedAt: now.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a valid (non-expired) entry for a specific gate and session.
 *
 * Returns null if:
 *   - No entry exists for the gate
 *   - No entry exists for the session
 *   - All matching entries are expired
 *   - State is invalid or missing
 *
 * This is the core decision function. Expired = absent. No fallback.
 */
export function getValidEntry(root, gate, sessionID) {
  const state = readState(root);

  // I-06: Fail-closed
  if (!state) return null;

  const { valid } = validateState(state);
  if (!valid) return null;

  // Find matching entry
  const entry = state.entries.find(e =>
    e.gate === gate &&
    (!sessionID || e.sessionID === sessionID) &&
    isEntryValid(e)
  );

  return entry || null;
}

/**
 * Check if a valid entry exists (boolean check).
 */
export function hasValidEntry(root, gate, sessionID) {
  return getValidEntry(root, gate, sessionID) !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize governance state if it doesn't exist.
 * Creates a fresh state with the given projectId.
 */
export function initState(root, projectId) {
  const existing = readState(root);
  if (existing) {
    const { valid } = validateState(existing);
    if (valid) return existing;
    // Invalid state — fall through to create new
  }

  const fresh = createState(root, projectId);
  writeState(root, fresh);
  return fresh;
}

/**
 * Load governance state, creating if necessary.
 * Validates and returns fresh state on any corruption.
 */
export function loadState(root, projectId) {
  const state = readState(root);
  if (!state) return initState(root, projectId);

  const { valid, reason } = validateState(state);
  if (!valid) {
    // Corrupt state — create fresh (I-06: fail-closed)
    const fresh = createState(root, projectId);
    writeState(root, fresh);
    return fresh;
  }

  return state;
}
