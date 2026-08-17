#!/usr/bin/env node

/**
 * behaviorOS - Independent reviewer gate (OAGE §26)
 *
 * A critical phase may only be marked "completed" once a 'review_approved' audit event
 * exists whose reviewedBy differs from every agent that wrote/edited during that phase.
 * Called from scripts/state-manager.ps1 before accepting Status=completed on a critical phase.
 *
 * Usage: node scripts/reviewer-check.mjs --phase F2
 * Exit code 0 = reviewed by an independent agent, 1 = missing/self-approved (blocks).
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--phase') out.phase = argv[i + 1];
  }
  return out;
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function main() {
  const { phase } = parseArgs(process.argv.slice(2));
  if (!phase) {
    console.error('Erro: --phase e obrigatorio');
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const gatePath = join(projectRoot, '.opencode', 'governance', 'reviewer-gate.json');
  if (!existsSync(gatePath)) {
    console.log('[WARN] reviewer-gate.json nao encontrado - a permitir transicao sem verificacao de revisor');
    process.exit(0);
  }
  const gate = JSON.parse(readFileSync(gatePath, 'utf8'));
  if (!gate.enabled) {
    console.log('[OK] reviewer-gate desactivado');
    process.exit(0);
  }

  const events = readJsonl(join(projectRoot, '.opencode', 'audit', 'audit.jsonl'));
  const phaseEvents = events.filter((e) => e.phase === phase || e.Phase === phase);

  // Audit entries come from two different writers with two different schemas:
  //   - .opencode/plugins/oage-audit.js  -> event: "tool_executed" (runtime plugin, OpenCode session)
  //   - scripts/audit-logger.ps1          -> event: "tool_call", result: "PASS"|"BLOCKED"|"ASK" (Rule 16 path)
  // Both must be recognized, or self-approval detection silently does nothing under whichever
  // path an agent actually used. A blocked/ask attempt didn't implement anything, so require
  // result === "PASS" for the tool_call schema (tool_executed only logs after success).
  const implementers = new Set(
    phaseEvents
      .filter((e) => {
        if (e.tool !== 'write' && e.tool !== 'edit') return false;
        if (e.event === 'tool_executed') return true;
        if (e.event === 'tool_call') return e.result === 'PASS';
        return false;
      })
      .map((e) => e.agent)
      .filter(Boolean)
  );

  // The Node plugin path (oage-audit.js) cannot attribute a real agent name to
  // 'tool_executed' events — @opencode-ai/plugin's tool.execute hooks only expose
  // { tool, sessionID, callID }, not an agent field (verified against the installed
  // package types). Every automatic write/edit therefore lands in `implementers` as the
  // literal string 'unknown', which would make ANY reviewedBy trivially "independent" —
  // silently defeating the self-review check for exactly the (automatic) path
  // INSTRUCTIONS.md tells agents to rely on. Fail closed instead: if attribution is
  // incomplete, we cannot prove independence, so don't claim we did.
  if (implementers.has('unknown')) {
    console.error(`[FAIL] Nao e possivel verificar revisao independente: fase ${phase} tem escritas com agente nao identificado ('unknown').`);
    console.error(`       O hook automatico do OpenCode nao expoe o nome do agente (apenas tool/sessionID/callID).`);
    console.error(`       Registe explicitamente quem implementou e quem reviu via: node scripts/audit-event.mjs --event review_approved --agent <revisor> --phase ${phase} --reviewedBy <revisor>`);
    console.error(`       e confirme manualmente que <revisor> e diferente de quem implementou.`);
    process.exit(1);
  }

  const reviews = phaseEvents.filter((e) => e.event === (gate.requiredAuditEvent || 'review_approved'));
  const independentReview = reviews.find((r) => r.reviewedBy && !implementers.has(r.reviewedBy));

  if (!independentReview) {
    console.error(`[FAIL] ${gate.message}`);
    console.error(`       Implementadores detectados na fase ${phase}: ${[...implementers].join(', ') || '(nenhum registado)'}`);
    console.error(`       Eventos de revisao encontrados: ${reviews.length}`);
    process.exit(1);
  }

  console.log(`[OK] Fase ${phase} revista por '${independentReview.reviewedBy}' (independente de: ${[...implementers].join(', ') || 'n/a'})`);
  process.exit(0);
}

main();
