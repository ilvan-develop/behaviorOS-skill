/**
 * OAGE Audit Plugin v2 — Grounding Evidence Recorder
 *
 * Records all tool calls AND detects specific events that serve as grounding evidence:
 *   - context7 queries → context7_queried (evidence of official docs)
 *   - skill loads → skill_load (evidence of domain knowledge)
 *   - version verification → version_verified (evidence of repo state)
 *   - read of architecture → architecture_read (evidence of design decisions)
 *   - read of INSTRUCTIONS → instructions_read (evidence of project conventions)
 *   - read of test files → test_read (evidence of testing patterns)
 *   - read of schema files → schema_read (evidence of data model)
 *
 * Grounding Evidence format:
 *   { event, evidenceType, source, confidence, target, agent, phase, risk }
 *
 * This feeds into the truth-gate and behavior resolution kernel.
 */

import { appendAudit, extractTarget, extractCommand, extractAgent, extractSessionID, currentPhase } from './lib/oage-lib.js';
import { detectTechnologies } from './lib/skill-engine.js';
import { detectPhase } from './lib/protocol-engine.js';

/**
 * Map tool + args to evidence type for grounding.
 */
function classifyEvidence(tool, args, target, command) {
  const evidence = [];

  // Context7 = official docs evidence
  if (tool === 'context7_resolve-library-id' || tool === 'context7_query-docs') {
    evidence.push({
      type: 'official-docs',
      source: 'context7',
      confidence: 90,
      detail: args.libraryId || args.libraryName || args.query || target,
    });
  }

  // Skill = domain knowledge evidence
  if (tool === 'skill') {
    evidence.push({
      type: 'domain-knowledge',
      source: 'skill',
      confidence: 85,
      detail: args.name || args.skill || target,
    });
  }

  // Read of package.json = repo state evidence
  if (tool === 'read' && target && /package\.json$/.test(target)) {
    evidence.push({
      type: 'repo-state',
      source: 'package.json',
      confidence: 100,
      detail: target,
    });
  }

  // Read of INSTRUCTIONS.md = project conventions evidence
  if (tool === 'read' && target && /INSTRUCTIONS\.md/i.test(target)) {
    evidence.push({
      type: 'project-conventions',
      source: 'INSTRUCTIONS.md',
      confidence: 95,
      detail: target,
    });
  }

  // Read of architecture files = design decisions evidence
  if (tool === 'read' && target && /architect/i.test(target)) {
    evidence.push({
      type: 'design-decisions',
      source: 'architecture',
      confidence: 90,
      detail: target,
    });
  }

  // Read of test files = testing patterns evidence
  if (tool === 'read' && target && /\.test\.|\.spec\./i.test(target)) {
    evidence.push({
      type: 'testing-patterns',
      source: 'tests',
      confidence: 80,
      detail: target,
    });
  }

  // Read of schema files = data model evidence
  if (tool === 'read' && target && /\.schema\.|schema\.prisma$/i.test(target)) {
    evidence.push({
      type: 'data-model',
      source: 'schema',
      confidence: 95,
      detail: target,
    });
  }

  // Read of contract files = API contract evidence
  if (tool === 'read' && target && /\.contract\./i.test(target)) {
    evidence.push({
      type: 'api-contract',
      source: 'contract',
      confidence: 90,
      detail: target,
    });
  }

  // Read of governance files = governance context evidence
  if (tool === 'read' && target && /governance\//i.test(target)) {
    const govType = /state-machine/i.test(target) ? 'phase-context' :
                    /blueprint/i.test(target) ? 'architecture-context' :
                    /INSTRUCTIONS/i.test(target) ? 'project-conventions' :
                    /risk-engine/i.test(target) ? 'risk-assessment' :
                    /policy-resolver/i.test(target) ? 'enforcement-policy' :
                    /execution-protocol/i.test(target) ? 'protocol-context' :
                    /knowledge-hierarchy/i.test(target) ? 'knowledge-context' :
                    /anti-patterns/i.test(target) ? 'anti-pattern-context' :
                    /protected-resources/i.test(target) ? 'security-context' :
                    /skill-gate/i.test(target) ? 'skill-context' :
                    /truth-gate/i.test(target) ? 'truth-context' :
                    /context7-gate/i.test(target) ? 'context7-context' :
                    'governance-context';
    evidence.push({
      type: govType,
      source: 'governance',
      confidence: 85,
      detail: target,
    });
  }

  // Bash quality check = quality verification evidence
  if (tool === 'bash' && command) {
    if (/\b(pnpm|npm|yarn)\s+(lint|typecheck|test|build)\b/.test(command)) {
      evidence.push({
        type: 'quality-verification',
        source: 'bash-quality',
        confidence: 85,
        detail: command.substring(0, 200),
      });
    }
  }

  return evidence;
}

export const OageAudit = async (ctx) => {
  const root = ctx.directory || ctx.worktree || process.cwd();

  return {
    'tool.execute.after': async (input) => {
      const tool = input.tool;
      const args = input.args || {};
      const agent = extractAgent(input);
      const sessionID = extractSessionID(input);
      const target = extractTarget(args);
      const command = extractCommand(args);
      const phase = currentPhase(root);
      const phaseProps = detectPhase(root);

      // ═══════════════════════════════════════════════════════════════════
      // Base audit entry for every tool call
      // ═══════════════════════════════════════════════════════════════════
      appendAudit(root, {
        event: 'tool_executed',
        tool,
        target,
        command: command?.substring(0, 200),
        agent,
        sessionID,
        phase,
        phasePosition: phaseProps?.position,
        phaseCritical: phaseProps?.isCritical,
      });

      // ═══════════════════════════════════════════════════════════════════
      // Grounding Evidence detection
      // ═══════════════════════════════════════════════════════════════════
      const evidence = classifyEvidence(tool, args, target, command);

      for (const ev of evidence) {
        appendAudit(root, {
          event: 'grounding_evidence',
          evidenceType: ev.type,
          source: ev.source,
          confidence: ev.confidence,
          target: ev.detail,
          tool,
          agent,
          sessionID,
          phase,
          phasePosition: phaseProps?.position,
          risk: null, // filled by enforce plugin if applicable
        });
      }

      // ═══════════════════════════════════════════════════════════════════
      // Legacy events (kept for backward compatibility with old gates)
      // ═══════════════════════════════════════════════════════════════════
      if (tool === 'context7_resolve-library-id' || tool === 'context7_query-docs') {
        appendAudit(root, {
          event: 'context7_queried',
          tool,
          target: args.libraryId || args.libraryName || args.query || target,
          agent,
          sessionID,
          phase,
        });
      }

      if (tool === 'skill') {
        appendAudit(root, {
          event: 'skill_load',
          skill: args.name || args.skill || target,
          agent,
          sessionID,
          phase,
        });
      }

      if (tool === 'read' && target && /package\.json$/.test(target)) {
        appendAudit(root, {
          event: 'version_verified',
          target,
          agent,
          sessionID,
          phase,
        });
      }

      if (tool === 'bash' && command) {
        if (/\b(pnpm|npm|yarn)\s+(lint|typecheck|test|build)\b/.test(command)) {
          appendAudit(root, {
            event: 'quality_check',
            command: command.substring(0, 200),
            agent,
            sessionID,
            phase,
          });
        }
      }
    },
  };
};

export default OageAudit;
