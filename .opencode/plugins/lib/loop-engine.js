/**
 * behaviorOS - Loop Governance engine (OAGE P1.1)
 *
 * Replaces "count identical calls, block at 4" with "score behavioural risk, escalate before
 * blocking". Three things forced the rewrite rather than a threshold tweak:
 *
 *  1. The detector only ever observed `bash`. In oage-enforce.js the read-only bypass returns
 *     before it, and write/edit return after evaluateFileWrite — so the repetition that matters
 *     most, rewriting the same file, was never seen at all.
 *  2. The signature used the RAW target, so `.opencode/x.json` and `C:\…\.opencode\x.json`
 *     counted as different actions: evadable by re-spelling a path, and over-counting at the
 *     same time. 240 of the 269 signatures on disk carried an absolute path.
 *  3. Blocking was the first response to ambiguity, and the audit recorded the consequence —
 *     a model blocked on a legitimate write went looking for a heredoc bypass instead of
 *     escalating. A gate that over-blocks legitimate work teaches agents to route around
 *     governance, which is worse than the repetition it prevents.
 *
 * The scoring turns on one distinction: ITERATING produces different content each time, so it
 * yields a different signature and never accumulates. REPEATING produces the identical call,
 * and only that accumulates.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, join } from 'node:path';

import {
  loadGovernanceJSON,
  readLoopState,
  writeLoopState,
  canonicalTarget,
  matchesAnyOrContains,
  extractBashMutatedPaths,
  classifyOperation,
  assessRisk,
} from './oage-lib.js';

export const LOOP_STATE_SCHEMA_VERSION = 2;

const NORMAL = 'NORMAL';
const WARN = 'WARN';
const ESCALATE = 'ESCALATE';
const BLOCK = 'BLOCK';

/** Stable id for this checkout, so one project's state can never govern another's. */
export function projectId(root) {
  return createHash('sha256').update(String(root).replace(/\\/g, '/').toLowerCase()).digest('hex').slice(0, 12);
}

function shortHash(value) {
  return createHash('sha256').update(value ?? '').digest('hex').slice(0, 16);
}

/** Read a file if it exists, tolerating unreadable paths. */
function readIfPresent(root, target) {
  if (!target) return null;
  const abs = isAbsolute(target) ? target : join(root, target);
  try {
    return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  } catch {
    return null;
  }
}

/**
 * Would this call actually change anything?
 *
 * Decided in the BEFORE hook, so it is a judgement about intent, not about the result. Being
 * wrong here is cheap in one direction only: a missed no-op just scores like a normal write.
 */
export function detectNoop(root, { tool, target, args = {} }) {
  if (tool === 'write') {
    const current = readIfPresent(root, target);
    return current !== null && current === (args.content ?? '');
  }
  if (tool === 'edit') {
    const oldString = args.oldString ?? args.old_string ?? '';
    const newString = args.newString ?? args.new_string ?? '';
    if (oldString === newString) return true;
    const current = readIfPresent(root, target);
    if (current === null) return false;
    // Already applied: the replacement is in the file and the thing to replace is not.
    return newString !== '' && current.includes(newString) && !current.includes(oldString);
  }
  return false;
}

/**
 * What KIND of action is this, in loop terms?
 *
 * Derived from classifyOperation so there is one operation vocabulary in the kernel, not two.
 * The three classes that cannot be read off an operation name — deletion, governance mutation,
 * security bypass — are recognised from the target and command instead.
 */
export function classifyAction(root, { tool, target, command, args = {} }, cfg) {
  const config = cfg || loadGovernanceJSON(root, 'loop-detector.json') || {};
  const classes = config.actionClasses || {};

  const canonical = target ? canonicalTarget(root, target) : null;
  const operation = classifyOperation(tool, args);

  let actionClass = classes[operation] || classes._default || 'WRITE';

  if (tool === 'edit') actionClass = 'EDIT';

  // Deletion and governance mutation are properties of the target, not of the tool name.
  const protectedCfg = loadGovernanceJSON(root, 'protected-resources.json');
  const denyWrite = protectedCfg?.denyWritePatterns || [];

  const touched = tool === 'bash' ? extractBashMutatedPaths(command) : (target ? [target] : []);
  const mutatesGovernance = touched.some((p) => matchesAnyOrContains(p, denyWrite, root));

  if (tool === 'bash' && touched.length > 0) actionClass = 'DELETE';
  if (mutatesGovernance) actionClass = 'GOVERNANCE_MUTATION';

  const noop = detectNoop(root, { tool, target, args });

  // Identical content ⇒ identical fingerprint ⇒ one signature. Different content each time —
  // which is what iterating on a file looks like — never accumulates.
  const mutationFingerprint = shortHash(
    tool === 'bash'
      ? command || ''
      : `${args.content ?? ''}|${args.oldString ?? args.old_string ?? ''}|${args.newString ?? args.new_string ?? ''}`,
  );

  return { actionClass, canonicalTarget: canonical, mutationFingerprint, noop, operation };
}

/** Weight one occurrence: nature of the action × risk of the target × whether it changes anything. */
export function scoreAction(root, { actionClass, canonicalTarget: canonical, noop, operation }, cfg) {
  const config = cfg || loadGovernanceJSON(root, 'loop-detector.json') || {};
  const base = config.weights?.[actionClass] ?? 0;
  if (base === 0) return 0; // READ/SEARCH stay zero whatever the risk of the file

  let multiplier = 1;
  if (canonical) {
    try {
      const risk = assessRisk(root, canonical, operation, null);
      multiplier = config.riskMultipliers?.[risk?.risk] ?? 1;
    } catch {
      multiplier = 1;
    }
  }

  return base * multiplier * (noop ? (config.noopMultiplier ?? 1) : 1);
}

/** Compose the signature from the fields the CONFIG lists, so that field means what it says. */
export function buildSignature(fields, cfg) {
  const order = cfg?.signature?.length
    ? cfg.signature
    : ['schemaVersion', 'projectId', 'sessionId', 'agent', 'phase', 'actionClass', 'canonicalTarget', 'mutationFingerprint'];
  return order.map((f) => `${fields[f] ?? ''}`).join('|');
}

/**
 * Load loop state, DISCARDING anything that does not belong to this project or schema.
 *
 * Discard rather than migrate: this state is derived, never a source of truth, so recomputing
 * it costs one window of observation. The live file proved why — 269 signatures, 232 of them
 * reads from an architecture that no longer exists, and 36 naming an entirely different
 * project whose session had run against this root.
 */
export function loadLoopState(root, kernelVersion = '1.1.0') {
  const fresh = {
    schemaVersion: LOOP_STATE_SCHEMA_VERSION,
    kernelVersion,
    projectId: projectId(root),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    signatures: {},
  };

  const state = readLoopState(root);
  if (!state || typeof state !== 'object') return fresh;
  if (state.schemaVersion !== LOOP_STATE_SCHEMA_VERSION) return fresh;
  if (state.projectId !== fresh.projectId) return fresh;
  if (!state.signatures || typeof state.signatures !== 'object') return fresh;

  return { ...fresh, createdAt: state.createdAt || fresh.createdAt, signatures: state.signatures };
}

/** Drop signatures with nothing left inside the window, then cap the total. */
function prune(state, windowMs, maxSignatures) {
  const now = Date.now();
  for (const [key, record] of Object.entries(state.signatures)) {
    const events = (record.events || []).filter(([t]) => now - t < windowMs);
    if (events.length === 0) delete state.signatures[key];
    else state.signatures[key] = { ...record, events };
  }

  const keys = Object.keys(state.signatures);
  if (keys.length > maxSignatures) {
    const byRecency = keys.sort((a, b) => {
      const last = (k) => Math.max(...state.signatures[k].events.map(([t]) => t));
      return last(a) - last(b);
    });
    for (const key of byRecency.slice(0, keys.length - maxSignatures)) delete state.signatures[key];
  }
}

/**
 * Record this call and return the verdict.
 *
 * NORMAL   allow, silently
 * WARN     allow, tell the agent it is repeating
 * ESCALATE allow ONCE more, record escalation_required, arm the signature
 * BLOCK    refuse — only after an escalation was already delivered
 */
export function evaluateRepetition(root, ctx) {
  const cfg = loadGovernanceJSON(root, 'loop-detector.json');
  if (!cfg?.enabled) return { level: NORMAL, score: 0, count: 0 };

  const { tool, target, command, args = {}, sessionID, agent, phase } = ctx;

  const action = classifyAction(root, { tool, target, command, args }, cfg);
  const weight = scoreAction(root, action, cfg);

  // Weight 0 (reads, searches) never accumulates and never writes state.
  if (weight === 0) return { level: NORMAL, score: 0, count: 0, ...action };

  const state = loadLoopState(root);
  const windowMs = (cfg.windowMinutes ?? 15) * 60 * 1000;
  prune(state, windowMs, cfg.maxSignatures ?? 200);

  const signature = buildSignature({
    schemaVersion: LOOP_STATE_SCHEMA_VERSION,
    projectId: state.projectId,
    sessionId: sessionID || 'nosession',
    agent: agent || 'unknown',
    phase: phase || 'unknown',
    actionClass: action.actionClass,
    canonicalTarget: action.canonicalTarget || '',
    mutationFingerprint: action.mutationFingerprint,
  }, cfg);

  const now = Date.now();
  const record = state.signatures[signature] || { events: [], armed: false };
  record.events = (record.events || []).filter(([t]) => now - t < windowMs);

  const wasArmed = record.armed === true;

  record.events.push([now, weight]);
  const score = record.events.reduce((sum, [, w]) => sum + w, 0);
  const count = record.events.length;

  const thresholds = cfg.thresholds || { warn: 4, escalate: 8, block: 14 };

  let level = NORMAL;
  if (score >= thresholds.block) level = BLOCK;
  else if (score >= thresholds.escalate) level = ESCALATE;
  else if (score >= thresholds.warn) level = WARN;

  // An escalation already told the agent to stop. Repeating the identical call after that is
  // the confirmed violation, whatever the score says.
  if (wasArmed && level !== NORMAL) level = BLOCK;

  if (level === ESCALATE && cfg.onEscalate?.armSignature !== false) record.armed = true;
  if (level === BLOCK) record.armed = true;

  state.signatures[signature] = record;
  state.updatedAt = new Date().toISOString();
  writeLoopState(root, state);

  const message = (cfg.messages?.[level.toLowerCase()] || '')
    .replace('{actionClass}', action.actionClass)
    .replace('{target}', action.canonicalTarget || ctx.command?.slice(0, 60) || 'ação')
    .replace('{count}', String(count))
    .replace('{score}', String(Math.round(score * 10) / 10))
    .replace('{windowMinutes}', String(cfg.windowMinutes ?? 15));

  return { level, score, count, signature, message, ...action };
}

export const LOOP_LEVELS = { NORMAL, WARN, ESCALATE, BLOCK };
