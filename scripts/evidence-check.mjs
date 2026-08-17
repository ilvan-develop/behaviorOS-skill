#!/usr/bin/env node

/**
 * behaviorOS - Evidence-Based Completion gate (OAGE §31-32)
 *
 * Validates that .opencode/evidence/{phase}.json exists and contains the fields required
 * by .opencode/governance/definition-of-done.json before a phase may be marked "completed".
 * Called from scripts/state-manager.ps1 when Status=completed.
 *
 * Usage: node scripts/evidence-check.mjs --phase F2
 * Exit code 0 = evidence sufficient, 1 = missing/insufficient (blocks the transition).
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

function main() {
  const { phase } = parseArgs(process.argv.slice(2));
  if (!phase) {
    console.error('Erro: --phase e obrigatorio');
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const governanceDir = join(projectRoot, '.opencode', 'governance');
  const dodPath = join(governanceDir, 'definition-of-done.json');
  const stateMachinePath = join(governanceDir, 'state-machine.json');

  if (!existsSync(dodPath)) {
    console.log('[WARN] definition-of-done.json nao encontrado - a permitir transicao sem verificacao de evidencia');
    process.exit(0);
  }

  const dod = JSON.parse(readFileSync(dodPath, 'utf8'));
  const evidencePath = join(projectRoot, dod.evidenceDir || '.opencode/evidence', dod.evidenceFilePattern.replace('{phase}', phase));

  if (!existsSync(evidencePath)) {
    console.error(`[FAIL] Ficheiro de evidencia em falta: ${evidencePath}`);
    console.error(`       Crie-o com os campos: ${dod.requiredEvidenceFields.join(', ')}`);
    process.exit(1);
  }

  let evidence;
  try {
    evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  } catch (err) {
    console.error(`[FAIL] Evidencia invalida (JSON malformado): ${err.message}`);
    process.exit(1);
  }

  let requiredFields = [...(dod.requiredEvidenceFields || [])];

  let isCritical = false;
  if (existsSync(stateMachinePath)) {
    const sm = JSON.parse(readFileSync(stateMachinePath, 'utf8'));
    const phaseInfo = (sm.states || []).find((s) => s.id === phase);
    isCritical = Boolean(phaseInfo?.isCritical);
  }
  if (isCritical && dod.conditionalEvidenceFields?.isCritical) {
    requiredFields = requiredFields.concat(dod.conditionalEvidenceFields.isCritical);
  }

  const missing = requiredFields.filter((f) => evidence[f] === undefined || evidence[f] === null || evidence[f] === '');

  if (missing.length > 0) {
    console.error(`[FAIL] Evidencia incompleta para fase ${phase}. Campos em falta: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`[OK] Evidencia completa para fase ${phase} (${requiredFields.length} campos verificados${isCritical ? ', incluindo campos de fase critica' : ''}).`);
  process.exit(0);
}

main();
