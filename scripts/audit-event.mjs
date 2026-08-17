#!/usr/bin/env node

/**
 * behaviorOS - Generic audit event logger
 *
 * Appends an arbitrary structured event to .opencode/audit/audit.jsonl, in the same
 * format .opencode/plugins/oage-*.mjs read from. Used to satisfy gates that require a
 * prior declaration: confidence_declared (truth-gate), dependency_justification
 * (dependency-gate), review_approved (reviewer-gate).
 *
 * Usage:
 *   node scripts/audit-event.mjs --event confidence_declared --agent backend --phase F2 --confidence 97
 *   node scripts/audit-event.mjs --event dependency_justification --agent backend --package ioredis --why "cache de sessao" --alternatives "node-cache" --license MIT
 *   node scripts/audit-event.mjs --event review_approved --agent qa --phase F2 --reviewedBy qa
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.event) {
    console.error('Erro: --event e obrigatorio (ex: confidence_declared, dependency_justification, review_approved)');
    process.exit(1);
  }

  if (args.confidence !== undefined) {
    args.confidence = Number(args.confidence);
    if (Number.isNaN(args.confidence) || args.confidence < 0 || args.confidence > 100) {
      console.error('Erro: --confidence deve ser um numero entre 0 e 100');
      process.exit(1);
    }
  }

  const projectRoot = process.cwd();
  const auditDir = join(projectRoot, '.opencode', 'audit');
  if (!existsSync(auditDir)) {
    mkdirSync(auditDir, { recursive: true });
  }

  const record = { timestamp: new Date().toISOString(), ...args };
  appendFileSync(join(auditDir, 'audit.jsonl'), JSON.stringify(record) + '\n');

  console.log(`[OK] Evento '${args.event}' registado em .opencode/audit/audit.jsonl`);
  console.log(JSON.stringify(record, null, 2));
}

main();
