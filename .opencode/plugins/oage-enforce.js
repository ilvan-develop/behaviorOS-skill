/**
 * OAGE Enforcement Plugin v2 — Behavior Resolution Kernel
 *
 * Replaces the old gate-based enforcement with adaptive Behavior Resolution.
 * Risk is calculated by phase PROPERTIES (isCritical, position), NOT by phase IDs.
 * Risk level drives enforcement intensity per operation type.
 *
 * Architecture:
 *   Risk Assessment (risk-engine.json)
 *   → Policy Resolution (policy-resolver.json)
 *   → Grounding Evidence (protocol-engine.js)
 *   → Technology Detection (skill-engine.js)
 *   → Enforcement Decision (this file)
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
  readLoopState,
  writeLoopState,
  extractTarget,
  extractCommand,
  extractContent,
  extractAgent,
  extractSessionID,
  extractBashFileWrites,
  extractBashMutatedPaths,
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
 */
function evaluateFileWrite(root, { tool, target, content, agent, sessionID, phase }) {
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

  // Context7 Gate — adaptive by risk.
  const ctx7Policy = policies.actions?.context7;
  if (ctx7Policy?.action === 'require') {
    const recentCtx7 = readAuditEvents(root, { event: 'context7_queried', windowMinutes: ctx7Policy.windowMinutes || 30, sessionID });
    if (recentCtx7.length === 0) {
      appendAudit(root, {
        event: 'context7_missing', gate: 'context7-adaptive',
        tool, target, agent, sessionID, phase, risk: risk.risk,
        note: `Context7 query required for ${operation} (risk: ${risk.risk})`,
      });
      throw new Error(`[OAGE] Context7 obrigatório para ${operation} (risk: ${risk.risk}). Consulte docs antes de implementar.`);
    }
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
        evaluateFileWrite(root, { tool, target, content, agent, sessionID, phase });
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
      }

      // ═══════════════════════════════════════════════════════════════════
      // PHASE 4: Loop detection — applies to every tool reaching this point (bash,
      // context7 calls, etc.). Scoped by sessionID: a repeated identical action within
      // the SAME session is a runaway-repetition signal; across unrelated sessions it
      // isn't — a fresh session (e.g. after switching model) retrying the very same first
      // legitimate write it has never attempted before must not inherit a block caused by
      // a previous, unrelated session's retries. (Previously global: a live test showed a
      // brand-new session get blocked on its very first write attempt because an earlier,
      // separate session had already retried that same write 4 times.)
      // ═══════════════════════════════════════════════════════════════════
      const loopCfg = loadGovernanceJSON(root, 'loop-detector.json');
      if (loopCfg?.enabled && (target || command)) {
        const signature = `${sessionID || 'nosession'}:${tool}:${target || ''}:${command || ''}`;
        const state = readLoopState(root);
        const now = Date.now();
        const windowMs = loopCfg.windowMinutes * 60 * 1000;
        const record = state.signatures[signature] || { timestamps: [] };
        record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
        record.timestamps.push(now);
        state.signatures[signature] = record;
        writeLoopState(root, state);

        if (record.timestamps.length > loopCfg.maxIdenticalAttempts) {
          appendAudit(root, {
            event: 'loop_detected', gate: 'loop-detector',
            tool, target, command, agent, sessionID, phase, count: record.timestamps.length,
          });
          const msg = loopCfg.onLoopDetected.message
            .replace('{count}', String(record.timestamps.length))
            .replace('{windowMinutes}', String(loopCfg.windowMinutes));
          throw new Error(`[OAGE] ${msg}`);
        }
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
  };
};

export default OageEnforce;
