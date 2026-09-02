/**
 * OAGE plugin shared utilities.
 *
 * Used by oage-enforce.js (tool.execute.before) and oage-audit.js (tool.execute.after).
 *
 * NOTE on the OpenCode plugin API: the public docs (opencode.ai/docs/plugins) confirm
 * `input.tool`, `output.args.filePath` (read/write/edit) and `output.args.command` (bash),
 * and that throwing inside `tool.execute.before` blocks execution. They do NOT document a
 * stable `agent` or `sessionID` field on `input`, nor the exact content field name for
 * write/edit. This file is defensive about both: it tries several plausible field names
 * and degrades to a global (non-agent-scoped) check rather than throwing on missing data.
 *
 * P1.2 Phase 2: appendAudit() now checks rotation thresholds before each write.
 * Rotation is transparent to callers — the signature is unchanged.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve as resolvePath, relative as relativePath } from 'node:path';
import { shouldRotate, rotate, loadConfig, readAuditWindow } from './audit-rotation.js';

export function governanceDir(root) {
  return join(root, '.opencode', 'governance');
}

export function auditDir(root) {
  return join(root, '.opencode', 'audit');
}

export function loadJSON(path, fallback = null) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

export function loadGovernanceJSON(root, filename, fallback = null) {
  return loadJSON(join(governanceDir(root), filename), fallback);
}

/**
 * Minimal glob matcher: supports a leading '**\/' (zero-or-more leading path segments, so
 * it also matches at the root — same semantics as .gitignore), '**' elsewhere, '*', '?' and
 * a leading '!' negation. No deps. Single-pass token replace so inserted regex syntax is
 * never re-matched by a later replace step.
 */
export function globToRegExp(glob) {
  const negate = glob.startsWith('!');
  const body = negate ? glob.slice(1) : glob;

  const pattern = body.replace(/\*\*\/|\*\*|\*|\?|[.\\+^$()|{}[\]]/g, (match) => {
    if (match === '**/') return '(?:.*/)?';
    if (match === '**') return '.*';
    if (match === '*') return '[^/]*';
    if (match === '?') return '.';
    return '\\' + match; // escaped regex-special literal
  });

  return { regex: new RegExp('^' + pattern + '$'), negate };
}

/**
 * Reduce any spelling of a path to the ONE canonical form that governance patterns are
 * written against: posix separators, relative to the project root.
 *
 * This exists because policy patterns are root-anchored (`.opencode/governance/**`) while the
 * OpenCode tools pass ABSOLUTE paths (`C:\…\project\.opencode\governance\x.json`) — and
 * globToRegExp anchors on `^`, so the two never met. The kernel's own self-protection
 * patterns therefore matched nothing in practice: an audit of 16 real write/edit calls to
 * `.opencode/governance|plugins|audit` found 16 allowed and 0 blocked, including a write to
 * oage-enforce.js itself. Prefixing the patterns with `**​/` would have papered over that one
 * list while leaving every future root-anchored pattern (and anti-patterns' `appliesTo`,
 * truth-gate's `criticalPatterns`) carrying the same trap. Canonicalizing the TARGET once,
 * here, is what makes a root-anchored pattern mean what it says.
 *
 * A target outside the root (e.g. `C:/Users/me/.ssh/id_rsa`, or an `..` escape) keeps its
 * absolute posix form rather than a `../..`-prefixed relative one: `**​/id_rsa*` still matches
 * it, and a pattern anchored at the project root correctly does NOT.
 */
export function canonicalTarget(root, target) {
  if (!target) return null;
  if (!root) return String(target).replace(/\\/g, '/');
  try {
    const abs = resolvePath(root, String(target));
    const rel = relativePath(root, abs).replace(/\\/g, '/');
    if (rel === '') return '.';
    if (rel.startsWith('../')) return abs.replace(/\\/g, '/');
    return rel;
  } catch {
    return String(target).replace(/\\/g, '/');
  }
}

/**
 * Returns true if `target` matches any positive pattern and no negation pattern.
 *
 * Pass `root` (the project directory) so the target is canonicalized before matching — see
 * canonicalTarget. Omitting it keeps the old raw-string behaviour, which only matches
 * repo-relative input; every enforcement call site passes it.
 */
export function matchesAny(target, patterns, root) {
  if (!target || !Array.isArray(patterns)) return false;
  const normalized = root ? canonicalTarget(root, target) : target.replace(/\\/g, '/');
  if (!normalized) return false;
  let matched = false;
  for (const p of patterns) {
    const { regex, negate } = globToRegExp(p);
    if (regex.test(normalized) || regex.test(normalized.replace(/^.*\//, ''))) {
      if (negate) return false; // explicit exemption wins
      matched = true;
    }
  }
  return matched;
}

/**
 * Like matchesAny, but also true when `target` is a DIRECTORY that contains protected files.
 *
 * `.opencode/governance/**` requires a child segment, so it matches
 * `.opencode/governance/truth-gate.json` but not `.opencode/governance` itself — meaning
 * `rm -rf .opencode/governance` destroys every policy without matching the policy that
 * forbids it. Probing with a sentinel child answers the question the pattern author actually
 * meant: "would anything inside here be protected?".
 *
 * Only meaningful for whole-path operations (delete/move/chmod); a write always names a file.
 */
export function matchesAnyOrContains(target, patterns, root) {
  if (matchesAny(target, patterns, root)) return true;
  const trimmed = String(target).replace(/[\\/]+$/, '');
  if (!trimmed) return false;
  return matchesAny(`${trimmed}/__oage_containment_probe__`, patterns, root);
}

/**
 * Wildcard matcher for shell command strings (dependency-gate.json's `patterns` /
 * `exemptPatterns`, e.g. "npm install *" / "pnpm add *"). Deliberately separate from
 * matchesAny/globToRegExp: commands aren't path-structured, so '*' here means "rest of the
 * line" and matches '/' too — otherwise scoped packages like '@nestjs/core' would silently
 * bypass the gate (globToRegExp's '*' excludes '/' on purpose, for path segments).
 */
export function matchesCommand(command, patterns) {
  if (!command || !Array.isArray(patterns)) return false;
  return patterns.some((p) => {
    const pattern = p.replace(/\*|[.\\+^$()|{}[\]]/g, (m) => (m === '*' ? '.*' : '\\' + m));
    return new RegExp('^' + pattern + '$').test(command);
  });
}

/**
 * Append an audit event to audit.jsonl with automatic rotation.
 *
 * P1.2 Phase 2: Before each append, checks if rotation is needed.
 * Rotation is transparent — the signature is unchanged from the original.
 *
 * Reads retention config from governance/audit.json (maxFileSize, maxEvents).
 * Rotates to archive/YYYY/MM/audit-YYYY-MM-DD.jsonl when thresholds exceeded.
 *
 * @param {string} root - Project root directory
 * @param {object} entry - Audit event to append
 * @returns {object} The appended record with timestamp
 */
export function appendAudit(root, entry) {
  const dir = auditDir(root);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // P1.2 Phase 2: Check rotation before append
  const config = loadConfig(root);
  const auditPath = join(dir, 'audit.jsonl');

  if (existsSync(auditPath)) {
    const check = shouldRotate(dir, config);
    if (check.rotate) {
      rotate(dir, config);
      // Record rotation event (I-18: rotation is audited)
      const rotationRecord = {
        timestamp: new Date().toISOString(),
        event: 'audit_rotated',
        reason: check.reason,
        eventsArchived: check.events,
        sizeArchived: check.size,
      };
      appendFileSync(auditPath, JSON.stringify(rotationRecord) + '\n');
    }
  }

  const record = { timestamp: new Date().toISOString(), ...entry };
  appendFileSync(auditPath, JSON.stringify(record) + '\n');
  return record;
}

/**
 * Reads recent audit events, optionally scoped to a single session.
 *
 * P1.2 Phase 3: Delegates to readAuditWindow for bounded, efficient reads.
 * The windowed reader only reads current.jsonl (bounded operational window)
 * and never touches archive.
 *
 * `sessionID` scoping matters because evidence (context7 query, skill load, grounding
 * evidence) should only satisfy a gate if it was produced by the current work stream.
 * Without it, a stale event from an unrelated session sitting inside the time window
 * would silently satisfy a gate for a task that never actually did the grounding.
 * Pass `sessionID: null`/omit to explicitly opt into a global (cross-session) read —
 * used by gates that are deliberately repo-wide (e.g. loop detection).
 */
export function readAuditEvents(root, { event, windowMinutes = 30, sessionID } = {}) {
  return readAuditWindow(auditDir(root), { event, windowMinutes, sessionID });
}

export function readLoopState(root) {
  const file = join(auditDir(root), 'loop-state.json');
  return loadJSON(file, { signatures: {} });
}

export function writeLoopState(root, state) {
  const dir = auditDir(root);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'loop-state.json'), JSON.stringify(state, null, 2));
}

/** Best-effort extraction of a target path from tool args across possible field names. */
export function extractTarget(args = {}) {
  return args.filePath || args.file_path || args.path || args.file || null;
}

/** Best-effort extraction of a bash command string. */
export function extractCommand(args = {}) {
  return args.command || args.cmd || args.script || null;
}

/**
 * Heuristically extract (target, content) pairs from a bash command that writes file
 * content via shell redirection, so bash-based writes can be routed through the same
 * governance pipeline (anti-patterns, protected-resources, context7/skill/knowledge gates,
 * version-pinning) as the write/edit tools. Covers the common cases a model actually uses:
 * heredoc (`cat > file <<'EOF' ... EOF`, also `tee` and `>>`/`<<-`) and single-line
 * `echo`/`printf` redirection. Not a full shell parser — a command not matching one of
 * these shapes yields no results and is simply not checked (a gap, not a false block).
 */
export function extractBashFileWrites(command) {
  if (!command) return [];
  const writes = [];

  const heredocRe = /(?:cat|tee)\s+(?:-a\s+)?>>?\s*("[^"]+"|'[^']+'|[^\s<]+)\s*<<[-~]?\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\2\b/g;
  let m;
  while ((m = heredocRe.exec(command))) {
    writes.push({ target: m[1].replace(/^['"]|['"]$/g, ''), content: m[3] });
  }

  const simpleRe = /(?:echo|printf)\s+(['"])([\s\S]*?)\1\s*>>?\s*("[^"]+"|'[^']+'|[^\s;&|]+)/g;
  while ((m = simpleRe.exec(command))) {
    writes.push({ target: m[3].replace(/^['"]|['"]$/g, ''), content: m[2] });
  }

  return writes;
}

/**
 * Extract the paths a bash command MUTATES (as opposed to reads), so protected resources can
 * be defended against shell verbs that never produce file content for extractBashFileWrites
 * to inspect: `rm`, `mv`, `cp`, `sed -i`, `truncate`, `git rm/checkout/restore`, `chmod`, and
 * in-place redirection.
 *
 * Without this, "the kernel cannot rewrite itself" was only true for the write/edit tools and
 * for heredocs — `rm .opencode/governance/protected-resources.json` deleted the policy that
 * forbids the deletion, and nothing in the pipeline looked at it. Deliberately scoped to
 * mutating verbs: reading governance files is normal and must stay allowed.
 *
 * Not a shell parser. Returns candidate path-ish tokens; the caller decides via pattern match.
 */
export function extractBashMutatedPaths(command) {
  if (!command) return [];

  // Split on separators so `ls foo && rm bar` is judged clause by clause, and a mutating verb
  // in one clause doesn't taint the operands of another.
  const clauses = String(command).split(/(?:&&|\|\||[;|\n])/);
  const MUTATORS = /(?:^|\s)(?:rm|rmdir|unlink|mv|cp|install|truncate|shred|chmod|chown|ln|dd)(?=\s)|(?:^|\s)sed\s+(?:-\w*i\w*|--in-place)|(?:^|\s)git\s+(?:rm|checkout|restore|clean)(?=\s)|(?:^|\s)(?:tee)(?=\s)|>>?\s*\S/;

  const out = [];
  for (const clause of clauses) {
    if (!MUTATORS.test(clause)) continue;
    // Tokens that look like paths: contain a separator or a dot, minus flags and operators.
    for (const raw of clause.split(/\s+/)) {
      const token = raw.replace(/^['"]|['"]$/g, '').replace(/^[<>]+/, '');
      if (!token || token.startsWith('-')) continue;
      if (!/[\\/.]/.test(token)) continue;
      if (/^[.]{1,2}$/.test(token)) continue;
      out.push(token);
    }
  }
  return [...new Set(out)];
}

export function extractInterpreterWrites(command) {
  if (!command) return [];

  const cmd = String(command);

  const INTERPRETER = /(?:^|\s)(?:node|python3?|perl|ruby|bun|deno|php|powershell|pwsh)(?:\.exe)?(?=\s)/;
  const PROTECTED = /\.opencode[/\\](?:governance|audit|plugins)/;
  const INLINE_WRITE =
    /writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream|truncate(?:Sync)?\s*\(|copyFile(?:Sync)?\s*\(|rename(?:Sync)?\s*\(|rm(?:Sync)?\s*\(|unlink(?:Sync)?\s*\(|rmdir(?:Sync)?\s*\(|mkdir(?:Sync)?\s*\(|\bFile\.write\b|\bf\.write\b|open\s*\([^)]*['"][wa>]|Put-Content|Set-Content|Add-Content|Out-File|Copy-Item|Move-Item|Remove-Item|New-Item/;
  const REDIRECT = />>?\s*([^\s"'&|;]+)/g;
  const PATH_RE = /\.opencode[/\\](?:governance|audit|plugins)(?:[/\\][A-Za-z0-9_.\\-]*)?/g;

  if (!INTERPRETER.test(cmd)) return [];
  if (!PROTECTED.test(cmd)) return [];

  const out = [];
  if (INLINE_WRITE.test(cmd)) {
    let m;
    while ((m = PATH_RE.exec(cmd))) out.push(m[0].replace(/\\/g, '/'));
  } else {
    let r;
    while ((r = REDIRECT.exec(cmd))) {
      const target = r[1].replace(/^['"]|['"]$/g, '');
      if (PROTECTED.test(target)) out.push(target.replace(/\\/g, '/'));
    }
  }
  return [...new Set(out)];
}

/** Best-effort extraction of write/edit content, falling back to concatenating all string args. */
export function extractContent(args = {}) {
  if (typeof args.content === 'string') return args.content;
  if (typeof args.newString === 'string') return args.newString;
  if (typeof args.new_string === 'string') return args.new_string;
  if (typeof args.text === 'string') return args.text;
  const strings = Object.values(args).filter((v) => typeof v === 'string');
  return strings.length ? strings.join('\n') : '';
}

/**
 * Best-effort extraction of an agent name. Verified against the installed
 * @opencode-ai/plugin types (.opencode/node_modules/@opencode-ai/plugin/dist/index.d.ts):
 * `tool.execute.before`/`tool.execute.after` input is `{ tool, sessionID, callID }` —
 * there is no `agent` field. This will always resolve to 'unknown' on the current SDK
 * version; kept defensive (not hardcoded) in case a future SDK version adds one, but
 * callers must not assume this can distinguish agents. Use `sessionID` (extractSessionID)
 * for work-stream scoping instead, and for gates that genuinely require knowing which
 * agent acted (e.g. reviewer-gate's "different agent" rule), rely on the explicit
 * `--agent` flag on scripts/audit-event.mjs rather than automatic hook attribution.
 */
export function extractAgent(input = {}) {
  return input.agent || input.agentName || input.agent_name || 'unknown';
}

/** Session identifier for the current tool call, per the installed plugin SDK. */
export function extractSessionID(input = {}) {
  return input.sessionID || null;
}

/** Reads the active phase from state-machine.json so audit entries can be phase-attributed
 * even though the OpenCode hook API doesn't expose a phase/agent field directly. */
export function currentPhase(root) {
  const sm = loadGovernanceJSON(root, 'state-machine.json');
  return sm?.currentState || 'unknown';
}

// --- Behavior Resolution helpers (imported from engines) ---

import { calculateRisk as _calculateRisk } from './risk-engine.js';
import { resolveAll as _resolveAll } from './policy-resolver.js';
import { detectTechnologies as _detectTechnologies, resolveSkills as _resolveSkills } from './skill-engine.js';
import { detectPhase as _detectPhase, validateStepCompletion as _validateStep, checkGroundingEvidence as _checkGroundingEvidence, PROTOCOL_STEPS } from './protocol-engine.js';

/** Classify an operation from tool name + args. */
export function classifyOperation(tool, args) {
  const target = extractTarget(args);
  const command = extractCommand(args);
  const content = extractContent(args);

  if (tool === 'read' || tool === 'glob' || tool === 'grep' || tool === 'list' || tool === 'skill') return 'read';
  if (tool === 'bash') {
    if (!command) return 'unknown';
    if (/^(npm|pnpm|yarn)\s+(run|test|lint|typecheck|build)\b/.test(command)) return 'test';
    if (/^(npm|pnpm|yarn)\s+(run\s+)?(lint|eslint|prettier|biome)\b/.test(command)) return 'lint';
    if (/^(npm|pnpm|yarn)\s+(run\s+)?typecheck\b/.test(command)) return 'typecheck';
    if (/^(npm|pnpm|yarn)\s+(run\s+)?build\b/.test(command)) return 'build';
    if (/^(npm|pnpm|yarn)\s+(install|add)\b/.test(command)) return 'install-dependency';
    if (/^(npm|pnpm|yarn)\s+(uninstall|remove)\b/.test(command)) return 'uninstall-dependency';
    if (/^git\s+commit\b/.test(command)) return 'git-commit';
    return 'bash-command';
  }
  if (!target) return 'unknown';

  // Classify by file path patterns
  if (/README/i.test(target)) return 'edit-readme';
  if (/docs?\//i.test(target)) return 'edit-docs';
  if (/\.test\.|\.spec\./i.test(target)) return 'edit-test';
  if (/\.config\./i.test(target)) return 'edit-config';
  if (/\.component\./i.test(target)) return 'edit-component';
  if (/\.page\./i.test(target)) return 'edit-page';
  if (/\.layout\./i.test(target)) return 'edit-layout';
  if (/\.service\./i.test(target)) return 'edit-service';
  if (/\.controller\./i.test(target)) return 'edit-controller';
  if (/\.schema\.|\.prisma$/i.test(target)) return 'edit-schema';
  if (/\.contract\./i.test(target)) return 'edit-contract';
  if (/\.module\./i.test(target)) return 'edit-module';
  if (/\.middleware\./i.test(target)) return 'edit-middleware';
  if (/\.guard\./i.test(target)) return 'edit-guard';
  if (/\.pipe\./i.test(target)) return 'edit-pipe';
  if (/\.decorator\./i.test(target)) return 'edit-decorator';
  if (/migration|\.migration\./i.test(target)) return 'edit-migration';
  if (/auth/i.test(target)) return 'edit-auth';
  if (/payment|finpay/i.test(target)) return 'edit-payment';
  if (/ledger/i.test(target)) return 'edit-ledger';
  if (/security/i.test(target)) return 'edit-security';
  if (/infra|docker|k8s/i.test(target)) return 'edit-infrastructure';
  if (/\.env/i.test(target)) return 'edit-environment';

  return 'edit-other';
}

/** Detect technologies from file path and content. */
export function detectTech(dir, target, content) {
  return _detectTechnologies(target, content);
}

/** Get current phase properties from state-machine.json. */
export function getPhaseProps(dir) {
  return _detectPhase(dir);
}

/** Calculate risk for a given operation. */
export function assessRisk(dir, target, operation, domain) {
  return _calculateRisk(dir, target, operation, domain);
}

/** Resolve all policies for a given operation. */
export function resolvePolicies(dir, operation, risk, skillsLoaded) {
  return _resolveAll(dir, operation, risk, skillsLoaded);
}

/**
 * Read loaded skills as a flat lookup: { "skill-name": true, ... }.
 *
 * Merges two sources, because the automatic path never writes the first one:
 *   1. .opencode/audit/skills-loaded.json — only ever populated by the manual
 *      scripts/skill-tracker.ps1 -Action load, which INSTRUCTIONS.md §17 tells agents
 *      NOT to call ("oage-audit.js faz isso automaticamente"). Kept for back-compat with
 *      sessions/tooling that do call it explicitly.
 *   2. Recent `skill_load` events in audit.jsonl — written automatically by
 *      oage-audit.js whenever the `skill` tool is used. This is the actual automatic
 *      path and, until this merge, the skill gate could never see it: readSkillsLoaded
 *      only read file #1, so `skill`-tool loads never satisfied the gate that
 *      INSTRUCTIONS.md §17 claims is automatic.
 * Scoped to `sessionID` when provided, so a skill loaded in an unrelated session doesn't
 * silently satisfy today's gate.
 */
export function readSkillsLoaded(root, { sessionID, windowMinutes = 240 } = {}) {
  const result = {};

  const file = join(auditDir(root), 'skills-loaded.json');
  const raw = loadJSON(file);
  if (raw) {
    if (Array.isArray(raw.skills)) {
      for (const entry of raw.skills) {
        const name = entry.name || entry.skill;
        if (name) result[name] = true;
      }
    } else if (typeof raw === 'object') {
      for (const [key, val] of Object.entries(raw)) {
        if (key === 'version' || key === 'project' || key === 'loadedAt') continue;
        if (typeof val === 'object' && val !== null) result[key] = true;
        else if (val === true) result[key] = true;
      }
    }
  }

  const events = readAuditEvents(root, { event: 'skill_load', windowMinutes, sessionID });
  for (const ev of events) {
    const name = ev.skill;
    if (name && name !== 'all') result[name] = true;
  }

  return result;
}

/** @deprecated use readSkillsLoaded — kept as an alias for existing callers. */
export function readSkillsMap(root, opts) {
  return readSkillsLoaded(root, opts);
}

/** Validate protocol step completion. */
export function validateProtocolStep(dir, stepId, evidence) {
  return _validateStep(dir, stepId, evidence);
}

/** Knowledge Gate: does recent grounding evidence satisfy the minimum hierarchy level for this risk? */
export function checkGroundingEvidence(dir, riskLevel, events) {
  return _checkGroundingEvidence(dir, riskLevel, events);
}
