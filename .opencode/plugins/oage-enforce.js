/**
 * OAGE Enforcement Plugin v2.1 — Behavior Resolution Kernel + Governance State
 *
 * P1.2 addition: Context7 Gate now reads from governance-state.json instead of audit.jsonl.
 *
 * Architecture:
 *   Risk Assessment (risk-engine.json)
 *   → Policy Resolution (policy-resolver.json)
 *   → Grounding Evidence (protocol-engine.js)
 *   → Technology Detection (skill-engine.js)
 *   → Enforcement Decision (this file)
 *
 *   governance-state.json  ← SOURCE OF DECISION (TTL-based, session-scoped)
 *   audit.jsonl            ← SOURCE OF EXPLANATION (append-only, historical)
 *
 * API: tool.execute.before(input, output) where input = { tool, sessionID, callID } and
 * output = { args }. Verified against the installed @opencode-ai/plugin types
 * (.opencode/node_modules/@opencode-ai/plugin/dist/index.d.ts) — there is no `agent` field
 * on this hook, only `sessionID`. Throwing inside the hook blocks execution.
 */

import { existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import {
  loadGovernanceJSON,
  matchesAny,
  matchesAnyOrContains,
  matchesCommand,
  appendAudit,
  readAuditEvents,
  extractTarget,
  extractCommand,
  extractContent,
  extractAgent,
  extractSessionID,
  extractBashFileWrites,
  extractBashMutatedPaths,
  extractInterpreterWrites,
  currentPhase,
  classifyOperation,
  detectTech,
  getPhaseProps,
  assessRisk,
  resolvePolicies,
  readSkillsLoaded,
  checkGroundingEvidence,
} from './lib/oage-lib.js';
import { detectTechnologies, resolveSkills } from './lib/skill-engine.js';
import { evaluateRepetition } from './lib/loop-engine.js';
import { getValidEntry } from './lib/governance-state.js';

/**
 * Loop verdicts decided in `tool.execute.before`, waiting for `tool.execute.after` to hand them
 * to the agent. Keyed by callID.
 *
 * The before hook can only throw or stay silent — it has no way to say "this worked, but you
 * are repeating yourself". The after hook, however, receives `output.output`: the text the
 * agent reads back. Appending there is what makes WARN and ESCALATE real steps rather than
 * audit entries nobody acts on, which matters because the whole point of the ladder is to warn
 * before blocking. Entries are deleted on consumption; a call that never reaches the after hook
 * (because some gate threw) leaves at most one stale entry, bounded below.
 */
const loopVerdicts = new Map();
const MAX_PENDING_VERDICTS = 100;

/**
 * Check if a tool is read-only (never blocked by Behavior Resolution, beyond the
 * protected-resources read check which runs before this bypass — see below).
 */
function isReadOnly(tool) {
  return ['read', 'glob', 'grep', 'list', 'skill'].includes(tool);
}

/**
 * Check if a tool is a transform (lint, test, typecheck via bash).
 */
function isTransform(tool, command) {
  if (tool !== 'bash' || !command) return false;
  return /^(npm|pnpm|yarn)\s+(run\s+)?(lint|test|typecheck|build)\b/.test(command);
}

/** Does `target` already exist on disk? Handles both absolute and root-relative paths. */
function fileExists(root, target) {
  if (!target) return false;
  try {
    return existsSync(isAbsolute(target) ? target : join(root, target));
  } catch {
    return false;
  }
}

/**
 * tool-gate.json's rules[] (deny/block/ask/allow, matched by tool+pattern) and
 * globalRules.forbiddenPatterns/requiredPatterns.
 *
 * Previously the kernel consumed tool-gate.json ONLY for the 'git-commit' rule (audit-only,
 * see PHASE 3e below) — despite the governance contract declaring the whole file "kernel,
 * runtime, fail-closed" with oage-enforce.js as a consumer. The 'destructive' (rm -rf),
 * 'git-push' (ask) and 'prisma-schema' (ask) rules, plus globalRules.forbiddenPatterns
 * (hardcoded password/secret), had exactly one real consumer: scripts/guards/tool-guard.ps1.
 * Nothing calls that script automatically — INSTRUCTIONS.md §16 explicitly tells agents not
 * to ("o plugin faz isso automaticamente"), which was true for every OTHER kernel policy but
 * not this one, so those rules were live-inert: declared enforced, adversarially tested via
 * subprocess against the PS1 guard in isolation, never actually applied to a real tool call.
 *
 * 'git-commit' stays a special case, handled separately in PHASE 3e: the kernel cannot itself
 * run lint/typecheck/test/coverage, so blocking on that rule here would invent an enforcement
 * the kernel cannot actually perform — it only audits which checks are required.
 *
 * Mirrors tool-guard.ps1's matching (first rule wins; 'allow' stops the search early) so the
 * same policy blocks the same way whether an agent goes through the kernel or the PS1 guard.
 */
function applyToolGateRules(root, { tool, target, command, content, agent, sessionID, phase }) {
  const cfg = loadGovernanceJSON(root, 'tool-gate.json');
  if (!cfg?.enabled) return;

  for (const rule of cfg.rules || []) {
    if (rule.id === 'git-commit') continue; // audit-only, see PHASE 3e
    if (rule.tool !== tool) continue;

    const matched = tool === 'bash'
      ? Boolean(command) && matchesCommand(command, [rule.pattern || '*'])
      : Boolean(target) && matchesAny(target, [rule.pattern || '*'], root);
    if (!matched) continue;

    if (rule.action === 'allow') {
      appendAudit(root, { event: 'tool_gate_allow', gate: 'tool-gate', ruleId: rule.id, tool, target, command: command?.substring(0, 200), agent, sessionID, phase });
      return;
    }

    appendAudit(root, {
      event: 'blocked', gate: 'tool-gate', ruleId: rule.id, action: rule.action,
      tool, target, command: command?.substring(0, 200), agent, sessionID, phase,
    });
    const what = command ? `: ${command.substring(0, 120)}` : target ? `: ${target}` : '';
    const verb = rule.action === 'ask' ? 'requer aprovação humana' : 'negada';
    throw new Error(`[OAGE] tool-gate "${rule.id}": ação ${verb} (${tool}${what}).`);
  }

  // globalRules are content-based, so only meaningful when there is content to inspect.
  if (!content) return;

  for (const forbidden of cfg.globalRules?.forbiddenPatterns || []) {
    if (!forbidden.pattern) continue;
    let re;
    try { re = new RegExp(forbidden.pattern, 'is'); } catch { continue; }
    if (re.test(content)) {
      appendAudit(root, { event: 'blocked', gate: 'tool-gate', ruleId: 'globalRules.forbiddenPatterns', tool, target, agent, sessionID, phase, message: forbidden.message });
      throw new Error(`[OAGE] tool-gate: ${forbidden.message || 'padrão proibido'} (${target}).`);
    }
  }

  for (const required of cfg.globalRules?.requiredPatterns || []) {
    if (!required.pattern || !required.filePattern) continue;
    if (!target || !matchesAny(target, [required.filePattern], root)) continue;
    let re;
    try { re = new RegExp(required.pattern); } catch { continue; }
    if (!re.test(content)) {
      // Warn only — tool-guard.ps1 does not block on requiredPatterns either.
      appendAudit(root, { event: 'tool_gate_warn', gate: 'tool-gate', ruleId: 'globalRules.requiredPatterns', tool, target, agent, sessionID, phase, message: required.message });
    }
  }
}

/**
 * Full Behavior Resolution pipeline for a single (target, content) file write — shared by
 * the write/edit tools AND by file writes embedded in a bash command (heredoc/redirection),
 * so a model can't bypass anti-patterns, protected-resources, context7/skill/knowledge
 * gates, or version-pinning content validation simply by using `bash cat > file <<EOF`
 * instead of the write/edit tools. This was a real, live-observed bypass: a governed write
 * to package.json was blocked by the loop-detector, and the model — rather than escalating —
 * retried via `bash` heredoc, which at the time skipped every content-based check and wrote
 * Prisma 6 (wrong major; the project pins Prisma 7) straight through.
 *
 * Throws to block. Returns normally (after logging `behavior_resolved`) to allow.
 *
 * Returns a loop verdict (or null) so the caller can surface WARN/ESCALATE to the agent via
 * the after hook — see the loopVerdicts map below.
 */
function evaluateFileWrite(root, { tool, target, content, agent, sessionID, phase, args }) {
  const operation = classifyOperation('write', { filePath: target, content });
  const risk = assessRisk(root, target, operation, null);
  const skillsMap = readSkillsLoaded(root, { sessionID });
  const policies = resolvePolicies(root, operation, risk.risk, Object.keys(skillsMap));

  // Protected resources — ALWAYS block regardless of risk.
  const protectedCfg = loadGovernanceJSON(root, 'protected-resources.json');
  if (protectedCfg?.enabled && target && matchesAny(target, protectedCfg.denyWritePatterns, root)) {
    appendAudit(root, { event: 'blocked', gate: 'protected-resources', tool, target, agent, sessionID, phase, risk: risk.risk });
    throw new Error(`[OAGE] ${protectedCfg.message} (${target})`);
  }

  // Tool gate — file-pattern rules (e.g. *.prisma → ask) and content-based globalRules
  // (e.g. hardcoded password/secret → deny). See applyToolGateRules for why this wasn't
  // wired in before.
  applyToolGateRules(root, { tool, target, content, agent, sessionID, phase });

  // Anti-pattern content scan.
  const antiPatterns = loadGovernanceJSON(root, 'anti-patterns.json');
  if (antiPatterns?.enabled) {
    for (const [category, entries] of Object.entries(antiPatterns.categories || {})) {
      for (const entry of entries) {
        if (entry.detection !== 'regex' || !entry.pattern) continue;
        if (entry.appliesTo && !matchesAny(target || '', [entry.appliesTo], root)) continue;
        // Some patterns (e.g. "model X {" for db-schema-without-migration) can't tell
        // "changed an existing file" from "defined it for the first time" — every file of
        // that kind matches on creation. requireExistingFile scopes those to actual edits,
        // so creating prisma/schema.prisma for the first time (normal F0/F1 work) isn't
        // treated the same as silently changing an already-migrated schema.
        if (entry.requireExistingFile && !fileExists(root, target)) continue;
        let re;
        // 's' (dotAll) so `.` spans newlines — real code is multi-line. Without it, a
        // pattern like db-missing-tenant-isolation's negative lookahead `(?!.*organizationId)`
        // only "sees" up to the next line break, so ANY normally-formatted multi-line
        // `findMany({ where: { ... organizationId ... } })` false-positives as missing
        // organizationId simply because it's on its own line — live-observed blocking
        // correctly tenant-isolated code, repeatedly, on a real write.
        try { re = new RegExp(entry.pattern, 'is'); } catch { continue; }
        if (content && re.test(content)) {
          appendAudit(root, {
            event: entry.severity === 'critical' ? 'blocked' : 'anti_pattern_flagged',
            gate: 'anti-patterns', antiPatternId: entry.id, category, severity: entry.severity,
            tool, target, agent, sessionID, phase, risk: risk.risk,
          });
          if (entry.severity === 'critical') {
            throw new Error(`[OAGE] Anti-pattern "${entry.name}" (${entry.id}): ${entry.message}`);
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Context7 Gate — P1.2: reads from governance-state.json (SOURCE OF DECISION)
  // instead of audit.jsonl (SOURCE OF EXPLANATION).
  //
  // Invariant I-03: expired state = absent. No fallback to audit trail.
  // Invariant I-06: missing/corrupt state → DENY.
  // ═══════════════════════════════════════════════════════════════════════
  const ctx7Policy = policies.actions?.context7;
  if (ctx7Policy?.action === 'require') {
    const validEntry = getValidEntry(root, 'context7', sessionID);
    if (!validEntry) {
      appendAudit(root, {
        event: 'context7_missing', gate: 'context7-adaptive',
        tool, target, agent, sessionID, phase, risk: risk.risk,
        note: `Context7 query required for ${operation} (risk: ${risk.risk}). Governance state: no valid entry found.`,
      });
      throw new Error(`[OAGE] Context7 obrigatório para ${operation} (risk: ${risk.risk}). Consulte docs antes de implementar.`);
    }
    // Entry found and valid — gate satisfied via governance state.
  }

  // Truth Gate — adaptive by risk level.
  const truthPolicy = policies.actions?.truth;
  if (truthPolicy?.action === 'require' && target) {
    const truthGate = loadGovernanceJSON(root, 'truth-gate.json');
    if (truthGate?.enabled && matchesAny(target, truthGate.criticalPatterns, root)) {
      const minConf = truthPolicy.minConfidence || 80;
      const recent = readAuditEvents(root, {
        event: truthGate.requiredAuditEvent, windowMinutes: truthGate.windowMinutes || 30, sessionID,
      }).filter(e => (e.confidence ?? 0) >= minConf);
      if (recent.length === 0) {
        appendAudit(root, {
          event: 'truth_missing', gate: 'truth-adaptive',
          tool, target, agent, sessionID, phase, risk: risk.risk, minConfidence: minConf,
        });
        throw new Error(`[OAGE] Truth gate: confiança mínima ${minConf}% para risk ${risk.risk}.`);
      }
    }
  }

  // Skill Gate — adaptive by risk. Respects policy `mode`: 'one-of' (default) means at
  // least one of `required` loaded is enough; 'all' means every one must be loaded.
  const skillPolicy = policies.actions?.skill;
  if (skillPolicy?.action === 'require' && target) {
    let required = skillPolicy.required || [];
    if (required.length === 0 && (risk.risk === 'HIGH' || risk.risk === 'CRITICAL')) {
      const detected = detectTechnologies(target, content);
      required = resolveSkills(detected);
    }
    if (required.length > 0) {
      const loadedSkills = Object.keys(skillsMap);
      const mode = skillPolicy.mode || 'one-of';
      const satisfied = mode === 'all'
        ? required.every(s => loadedSkills.includes(s))
        : required.some(s => loadedSkills.includes(s));
      if (!satisfied) {
        const missing = required.filter(s => !loadedSkills.includes(s));
        appendAudit(root, {
          event: 'skill_missing', gate: 'skill-adaptive',
          tool, target, agent, sessionID, phase, risk: risk.risk, missing, required, mode,
        });
        if (risk.risk === 'HIGH' || risk.risk === 'CRITICAL') {
          throw new Error(`[OAGE] Skill obrigatória ausente (${mode}): ${required.join(mode === 'all' ? ' E ' : ' OU ')}. Carregue antes de implementar.`);
        }
      }
    }
  }

  // Knowledge Gate — GROUND step (execution-protocol.json) / knowledge-hierarchy.json.
  const knowledgePolicy = policies.actions?.knowledge;
  if (knowledgePolicy?.action === 'require' && target) {
    const recentEvidence = readAuditEvents(root, { event: 'grounding_evidence', windowMinutes: 240, sessionID });
    const result = checkGroundingEvidence(root, risk.risk, recentEvidence);
    if (!result.valid) {
      appendAudit(root, {
        event: 'knowledge_evidence_missing', gate: 'knowledge-adaptive',
        tool, target, agent, sessionID, phase, risk: risk.risk, minLevel: result.minLevel,
      });
      if (risk.risk === 'HIGH' || risk.risk === 'CRITICAL') {
        throw new Error(`[OAGE] Knowledge gate: sem evidência de grounding suficiente para risk ${risk.risk} (nível mínimo ${result.minLevel}). Consulte repo/docs antes de implementar.`);
      }
    }
  }

  // Version pinning — content validation against version-registry.json.
  const vpCfg = loadGovernanceJSON(root, 'version-pinning-gate.json');
  if (vpCfg?.enabled && target) {
    // Matches only the configured manifest file itself (default package.json), not every
    // .json/.lock/.yaml file in the repo — the previous regex (`/\.(json|lock|yaml|yml)$/`)
    // fired on ANY json file, including .opencode/audit/loop-state.json, live-blocking an
    // unrelated internal write with "verify package.json first" for a file that has nothing
    // to do with dependencies.
    const packageJsonBasename = (vpCfg.packageJsonPath || 'package.json').split('/').pop();
    const isPackageJson = target.replace(/\\/g, '/').split('/').pop() === packageJsonBasename;

    // "Verify the current version before writing" only makes sense when there IS a
    // current version to verify — i.e. package.json already exists. Requiring a prior
    // read on first-time creation is unsatisfiable (there's nothing to read yet) and
    // live-blocked creating a brand-new package.json in a fresh project with no escape
    // other than bypassing write/edit entirely. First creation skips straight to the
    // content-validation check below, which is the one that actually matters here.
    if (vpCfg.requirePackageJsonCheck && isPackageJson && fileExists(root, target)) {
      const recentVersionCheck = readAuditEvents(root, {
        event: vpCfg.auditEvent || 'version_verified', windowMinutes: vpCfg.windowMinutes || 60, sessionID,
      });
      const packageJsonRead = recentVersionCheck.some(e => (e.target || '').includes(packageJsonBasename));
      if (!packageJsonRead) {
        appendAudit(root, { event: 'version_pinning_warn', gate: 'version-pinning', tool, target, agent, sessionID, phase, risk: risk.risk });
        if (vpCfg.action === 'block') {
          throw new Error(`[OAGE] ${vpCfg.message}`);
        }
      }
    }

    if (isPackageJson && vpCfg.versionValidation?.enabled && content) {
      try {
        const pkg = JSON.parse(content);
        const registry = loadGovernanceJSON(root, 'version-registry.json');
        if (registry?.libraries) {
          const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          const mismatches = [];
          for (const [dep, writtenVersion] of Object.entries(allDeps)) {
            const normalized = dep.replace(/^@[^/]+\//, '').toLowerCase();
            const expected = registry.libraries[normalized] || registry.libraries[dep];
            if (expected?.currentMajor && writtenVersion) {
              const majorMatch = writtenVersion.match(/\^?(\d+)/);
              if (majorMatch) {
                const writtenMajor = parseInt(majorMatch[1], 10);
                if (writtenMajor !== expected.currentMajor) {
                  mismatches.push({ lib: dep, written: writtenVersion, expected: `^${expected.currentMajor}.0.0` });
                }
              }
            }
          }
          if (mismatches.length > 0) {
            appendAudit(root, { event: 'version_mismatch', gate: 'version-pinning', tool, target, agent, sessionID, phase, risk: risk.risk, mismatches });
            throw new Error(`[OAGE] Versão incorreta: ${mismatches.map(m => `${m.lib}=${m.written} (esperado ${m.expected})`).join(', ')}`);
          }
        }
      } catch (e) {
        if (e.message?.startsWith('[OAGE]')) throw e;
        // JSON.parse failure or similar — not a governance concern, ignore.
      }
    }
  }

  appendAudit(root, {
    event: 'behavior_resolved', gate: 'behavior-resolution',
    tool, target, agent, sessionID, phase, risk: risk.risk, riskEvidence: risk.evidence, operation,
  });

  // Loop governance runs LAST, so a call the other gates would reject anyway never accumulates
  // repetition score. This is the path that used to escape it entirely: write/edit return from
  // the before hook right here, never reaching the old PHASE 4 block.
  return applyLoopVerdict(root, { tool, target, args: args || { filePath: target, content }, agent, sessionID, phase });
}

/**
 * Score the repetition and act on the verdict: throw on BLOCK, otherwise return the verdict so
 * the caller can hand WARN/ESCALATE to the agent through the after hook.
 */
function applyLoopVerdict(root, ctx) {
  const verdict = evaluateRepetition(root, ctx);
  if (!verdict || verdict.level === 'NORMAL') return null;

  const cfg = loadGovernanceJSON(root, 'loop-detector.json');
  const auditEvent = verdict.level === 'BLOCK'
    ? 'loop_detected'
    : verdict.level === 'ESCALATE'
      ? (cfg?.onEscalate?.auditEvent || 'escalation_required')
      : 'loop_warning';

  appendAudit(root, {
    event: auditEvent, gate: 'loop-detector',
    tool: ctx.tool, target: verdict.canonicalTarget, command: ctx.command?.substring(0, 200),
    agent: ctx.agent, sessionID: ctx.sessionID, phase: ctx.phase,
    level: verdict.level, score: verdict.score, count: verdict.count,
    actionClass: verdict.actionClass, noop: verdict.noop,
  });

  if (verdict.level === 'BLOCK') throw new Error(`[OAGE] ${verdict.message}`);
  return verdict;
}

/** Park a verdict for the after hook, evicting the oldest if a run leaves entries behind. */
function rememberVerdict(callID, verdict) {
  if (!callID) return;
  if (loopVerdicts.size >= MAX_PENDING_VERDICTS) {
    loopVerdicts.delete(loopVerdicts.keys().next().value);
  }
  loopVerdicts.set(callID, verdict);
}

export const OageEnforce = async (ctx) => {
  const root = ctx.directory || ctx.worktree || process.cwd();

  return {
    'tool.execute.before': async (input, output) => {
      const tool = input.tool;
      const args = output.args || {};
      const agent = extractAgent(input);
      const sessionID = extractSessionID(input);
      const target = extractTarget(args);
      const command = extractCommand(args);
      const content = extractContent(args);
      const phase = currentPhase(root);

      // ═══════════════════════════════════════════════════════════════════
      // PHASE -1: Protected-resource READ check — must run BEFORE the read-only bypass
      // below. A "read" tool call on .env/secrets/private keys is exactly the case
      // protected-resources.json's denyReadPatterns exists to block. Previously the
      // read-only bypass returned unconditionally for tool==='read' before this check
      // ever ran, making denyReadPatterns entirely dead code — any agent could read
      // .env, secrets/, credentials/, *.pem/*.key/id_rsa*, AWS/SSH config, terraform
      // state, etc. freely, despite the file being enabled and documented as "nunca
      // acessíveis, mesmo em leitura" (never accessible, not even for reading).
      // ═══════════════════════════════════════════════════════════════════
      if (tool === 'read' && target) {
        const protectedCfg = loadGovernanceJSON(root, 'protected-resources.json');
        if (protectedCfg?.enabled && matchesAny(target, protectedCfg.denyReadPatterns, root)) {
          appendAudit(root, { event: 'blocked', gate: 'protected-resources', tool, target, agent, sessionID, phase, risk: 'CRITICAL' });
          throw new Error(`[OAGE] ${protectedCfg.message} (${target})`);
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // PHASE 0: Read-only tools — never blocked beyond the check above.
      // ═══════════════════════════════════════════════════════════════════
      if (isReadOnly(tool)) return;

      // ═══════════════════════════════════════════════════════════════════
      // PHASE 1: Transform tools — bypass enforcement (quality tools)
      // ═══════════════════════════════════════════════════════════════════
      if (isTransform(tool, command)) {
        appendAudit(root, {
          event: 'transform_allowed', gate: 'behavior-resolution',
          tool, command: command?.substring(0, 200), agent, sessionID, phase,
        });
        return;
      }

      // ═══════════════════════════════════════════════════════════════════
      // PHASE 2: write/edit — run the full file-write pipeline directly.
      // ═══════════════════════════════════════════════════════════════════
      if (tool === 'write' || tool === 'edit') {
        const verdict = evaluateFileWrite(root, { tool, target, content, agent, sessionID, phase, args });
        if (verdict) rememberVerdict(input.callID, verdict);
        return;
      }

      // ═══════════════════════════════════════════════════════════════════
      // PHASE 3: bash — everything below is bash-specific.
      // ═══════════════════════════════════════════════════════════════════
      if (tool === 'bash' && command) {
        // 3a. File writes embedded in the command (heredoc, `>`/`>>` redirection, `tee`)
        // go through the SAME pipeline as write/edit — otherwise `bash cat > file <<EOF`
        // is an unrestricted bypass of anti-patterns, protected-resources, context7/skill/
        // knowledge gates and version-pinning, as observed live (see evaluateFileWrite doc).
        const embeddedWrites = extractBashFileWrites(command);
        for (const w of embeddedWrites) {
          evaluateFileWrite(root, { tool: 'bash', target: w.target, content: w.content, agent, sessionID, phase });
        }

        // 3b. Kernel integrity via shell verbs. A protected resource can be destroyed without
        // ever producing file content (`rm`, `mv`, `sed -i`, `git checkout --`), so the
        // content-based pipeline in 3a never sees it. Same policy list, applied to the paths
        // the command mutates.
        const protectedCfg = loadGovernanceJSON(root, 'protected-resources.json');
        if (protectedCfg?.enabled) {
          for (const mutated of extractBashMutatedPaths(command)) {
            // Containment-aware: `rm -rf .opencode/governance` names the directory, not a file
            // inside it, so a `…/**` pattern alone would let the whole policy set be deleted.
            if (matchesAnyOrContains(mutated, protectedCfg.denyWritePatterns, root)) {
              appendAudit(root, {
                event: 'blocked', gate: 'protected-resources',
                tool, target: mutated, command: command.substring(0, 200), agent, sessionID, phase, risk: 'CRITICAL',
                note: 'shell verb mutating a protected resource',
              });
              throw new Error(`[OAGE] ${protectedCfg.message} (${mutated})`);
            }
          }

          for (const interp of extractInterpreterWrites(command)) {
            if (matchesAnyOrContains(interp, protectedCfg.denyWritePatterns, root)) {
              appendAudit(root, {
                event: 'blocked', gate: 'protected-resources',
                tool, target: interp, command: command.substring(0, 200), agent, sessionID, phase, risk: 'CRITICAL',
                note: 'interpreter writing protected resource',
              });
              throw new Error(`[OAGE] ${protectedCfg.message} (${interp})`);
            }
          }
        }

        // 3c. Bash-specific anti-patterns (e.g. destructive git commands).
        const antiPatterns = loadGovernanceJSON(root, 'anti-patterns.json');
        for (const entry of antiPatterns?.categories?.git || []) {
          if (entry.detection !== 'regex' || !entry.pattern) continue;
          let re;
          try { re = new RegExp(entry.pattern, 's'); } catch { continue; }
          if (re.test(command)) {
            appendAudit(root, { event: 'blocked', gate: 'anti-patterns', antiPatternId: entry.id, tool, command, agent, sessionID, phase });
            throw new Error(`[OAGE] ${entry.name}: ${entry.message}`);
          }
        }

        // 3d. Dependency gate.
        const depGate = loadGovernanceJSON(root, 'dependency-gate.json');
        if (depGate?.enabled) {
          const isInstall = matchesCommand(command, depGate.patterns) && !matchesCommand(command, depGate.exemptPatterns || []);
          if (isInstall) {
            const recent = readAuditEvents(root, { event: depGate.requiredAuditEvent, windowMinutes: 30, sessionID });
            if (recent.length === 0) {
              appendAudit(root, { event: 'blocked', gate: 'dependency-gate', tool, command, agent, sessionID, phase });
              throw new Error(`[OAGE] ${depGate.message}`);
            }
          }
        }

        // 3e. Quality gates pre-commit (audit only — actual check runs client-side/CI).
        if (/^git\s+commit\b/.test(command)) {
          const toolGate = loadGovernanceJSON(root, 'tool-gate.json');
          const commitRule = toolGate?.rules?.find((r) => r.id === 'git-commit');
          if (commitRule?.checks) {
            appendAudit(root, {
              event: 'quality_gate_check', gate: 'quality-gates',
              tool, command, agent, sessionID, phase,
              checks: commitRule.checks.filter(c => c.required).map(c => c.name),
            });
          }
        }

        // 3f. Tool gate — command-pattern rules (e.g. rm -rf → deny, git push → ask).
        // Excludes 'git-commit', handled as audit-only above. See applyToolGateRules.
        applyToolGateRules(root, { tool, command, agent, sessionID, phase });
      }

      // ═══════════════════════════════════════════════════════════════════
      // PHASE 4: Loop governance — scores behavioural risk instead of counting calls.
      // See lib/loop-engine.js. Still session-scoped (a fresh session must not inherit
      // another session's retries), and now also phase- and project-scoped.
      // ═══════════════════════════════════════════════════════════════════
      if (target || command) {
        const verdict = applyLoopVerdict(root, { tool, target, command, args, agent, sessionID, phase });
        if (verdict) rememberVerdict(input.callID, verdict);
      }

      // ═══════════════════════════════════════════════════════════════════
      // PHASE 5: Audit — record the decision for any tool not already logged above
      // (write/edit and bash-embedded-writes log their own `behavior_resolved` inside
      // evaluateFileWrite; this covers everything else that reaches this point, e.g.
      // context7 calls, plain bash commands with no embedded file write).
      // ═══════════════════════════════════════════════════════════════════
      if (tool !== 'write' && tool !== 'edit') {
        const operation = classifyOperation(tool, args);
        const risk = assessRisk(root, target, operation, null);
        appendAudit(root, {
          event: 'behavior_resolved', gate: 'behavior-resolution',
          tool, target, command: command?.substring(0, 200), agent, sessionID, phase,
          risk: risk.risk, riskEvidence: risk.evidence, operation,
        });
      }
    },

    // Delivers WARN/ESCALATE to the agent. `output.output` is the text the model reads back
    // from the tool, so this is the only channel the plugin API gives for "allowed, but stop
    // repeating" — without it the ladder would exist only in the audit trail, and an agent
    // would walk from NORMAL to BLOCK having been told nothing.
    'tool.execute.after': async (input, output) => {
      const verdict = loopVerdicts.get(input.callID);
      if (!verdict) return;
      loopVerdicts.delete(input.callID);

      if (typeof output?.output !== 'string') return;
      output.output = `${output.output}\n\n[OAGE ${verdict.level}] ${verdict.message}`;
    },
  };
};

export default OageEnforce;
