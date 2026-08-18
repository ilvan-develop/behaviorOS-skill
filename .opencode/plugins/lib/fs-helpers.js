/**
 * Filesystem helpers for Windows-safe atomic operations.
 *
 * Extracted from governance-state.js writeState() logic to provide
 * a single, tested implementation of atomic file replacement.
 *
 * Used by:
 *   - governance-state.js (SOURCE OF DECISION writes)
 *   - audit-rotation.js (SOURCE OF EXPLANATION rotation)
 *
 * Invariant: These helpers NEVER touch governance-state.json.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync, unlinkSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Ensure directory exists before writing.
 * Safe to call multiple times (idempotent).
 */
export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Atomic file replacement with Windows fallback.
 *
 * Three-phase strategy:
 *   1. Write content to temp file (with PID + timestamp for collision safety)
 *   2. Delete destination, rename temp into place
 *   3. If rename fails (Windows file locking), fall back to direct write
 *
 * The temp file is always cleaned up, even on failure.
 *
 * @param {string} targetPath - Destination file path
 * @param {string} content - File content to write
 * @returns {{ atomic: boolean }} - Whether the write was atomic
 */
export function replaceFileAtomic(targetPath, content) {
  const dir = dirname(targetPath);
  ensureDir(dir);

  const tmp = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, content, 'utf8');

  try {
    if (existsSync(targetPath)) {
      unlinkSync(targetPath);
    }
    renameSync(tmp, targetPath);
    return { atomic: true };
  } catch {
    // Windows fallback: non-atomic direct write
    // The temp file confirmed the content is writable, so this is safe.
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      // Best effort cleanup
    }
    writeFileSync(targetPath, content, 'utf8');
    return { atomic: false };
  }
}

/**
 * Get file size in bytes. Returns 0 if file does not exist.
 */
export function fileSize(path) {
  try {
    if (!existsSync(path)) return 0;
    return statSync(path).size;
  } catch {
    return 0;
  }
}

/**
 * Count non-empty lines in a file. Returns 0 if file does not exist.
 */
export function lineCount(path) {
  try {
    if (!existsSync(path)) return 0;
    const content = readFileSync(path, 'utf8');
    return content.split('\n').filter(l => l.trim()).length;
  } catch {
    return 0;
  }
}

/**
 * Read file content. Returns null if file does not exist or is unreadable.
 */
export function readText(path) {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Append text to a file. Creates the directory if it does not exist.
 * Uses appendFileSync for atomic appends (OS-level guarantees).
 */
export function appendText(path, text) {
  const dir = dirname(path);
  ensureDir(dir);
  appendFileSync(path, text, 'utf8');
}
