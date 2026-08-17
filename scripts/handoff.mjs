#!/usr/bin/env node

/**
 * behaviorOS - Handoff generator (OAGE §30)
 *
 * Generates a structured handoff document between agents/phases, validated against
 * .opencode/governance/handoff-schema.json, so the next agent doesn't depend solely on
 * raw conversation history.
 *
 * Usage:
 *   node scripts/handoff.mjs --from backend --to qa --phase F2 \
 *     --task "Implementar endpoint de pagamentos" \
 *     --context "Ver decisions.md#payments-flow" \
 *     --files-changed "src/payments/payment.service.ts,src/payments/payment.controller.ts" \
 *     --skills-used "nestjs,prisma" \
 *     --next-action "QA deve validar cobertura de testes de idempotencia"
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
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

function toList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = process.cwd();

  const schemaPath = join(projectRoot, '.opencode', 'governance', 'handoff-schema.json');
  const schema = existsSync(schemaPath) ? JSON.parse(readFileSync(schemaPath, 'utf8')) : null;

  const doc = {
    from: args.from || 'unknown',
    to: args.to || 'unknown',
    task: args.task || '',
    context: args.context || '',
    decisions: toList(args.decisions),
    assumptions: toList(args.assumptions),
    filesRead: toList(args.filesRead),
    filesChanged: toList(args.filesChanged),
    skillsUsed: toList(args.skillsUsed),
    commandsExecuted: toList(args.commandsExecuted),
    validation: {
      lint: args.lint || 'not-run',
      typecheck: args.typecheck || 'not-run',
      test: args.test || 'not-run',
      build: args.build || 'not-run',
    },
    knownRisks: toList(args.knownRisks),
    openIssues: toList(args.openIssues),
    nextAction: args.nextAction || '',
  };

  if (schema) {
    // Schema-driven: array/object fields are satisfied by mere presence (an empty
    // filesRead/commandsExecuted is a legitimate handoff, e.g. a planning-only one) —
    // only string fields (task, context, nextAction...) must be genuinely non-empty.
    const missing = (schema.required || []).filter((field) => {
      const value = doc[field];
      const propType = schema.properties?.[field]?.type;
      if (propType === 'array') return !Array.isArray(value);
      if (propType === 'object') return value === undefined;
      return value === undefined || value === '';
    });
    if (missing.length > 0) {
      console.error(`[FAIL] Campos obrigatorios em falta: ${missing.join(', ')}`);
      process.exit(1);
    }
  }

  const handoffsDir = join(projectRoot, '.opencode', 'handoffs');
  if (!existsSync(handoffsDir)) mkdirSync(handoffsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `${doc.from}-to-${doc.to}-${timestamp}`;

  writeFileSync(join(handoffsDir, `${baseName}.json`), JSON.stringify(doc, null, 2));

  const md = `# Handoff: ${doc.from} -> ${doc.to}

**Timestamp:** ${new Date().toISOString()}

## Task
${doc.task}

## Context
${doc.context}

## Decisions
${doc.decisions.map((d) => `- ${d}`).join('\n') || '(nenhuma)'}

## Assumptions
${doc.assumptions.map((a) => `- ${a}`).join('\n') || '(nenhuma)'}

## Files Read
${doc.filesRead.map((f) => `- ${f}`).join('\n') || '(nenhum)'}

## Files Changed
${doc.filesChanged.map((f) => `- ${f}`).join('\n') || '(nenhum)'}

## Skills Used
${doc.skillsUsed.join(', ') || '(nenhuma)'}

## Commands Executed
${doc.commandsExecuted.map((c) => `- \`${c}\``).join('\n') || '(nenhum)'}

## Validation
- Lint: ${doc.validation.lint}
- Typecheck: ${doc.validation.typecheck}
- Test: ${doc.validation.test}
- Build: ${doc.validation.build}

## Known Risks
${doc.knownRisks.map((r) => `- ${r}`).join('\n') || '(nenhum)'}

## Open Issues
${doc.openIssues.map((i) => `- ${i}`).join('\n') || '(nenhum)'}

## Next Action
${doc.nextAction}
`;

  writeFileSync(join(handoffsDir, `${baseName}.md`), md);

  console.log(`[OK] Handoff gerado: .opencode/handoffs/${baseName}.{json,md}`);
}

main();
