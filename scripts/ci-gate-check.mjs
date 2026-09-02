#!/usr/bin/env node

/**
 * behaviorOS - CI gate declaration check
 *
 * Usage: node scripts/ci-gate-check.mjs [--workflow <path>]
 *
 * Reads .opencode/governance/ci-gate.json and confronts its `required` checks with the CI
 * pipeline. Every required check must map to a step in the workflow, or be legitimately
 * skipped (skipIfMissing with no package.json script to run). A required check with no step
 * fails the pipeline, so the declared gate cannot silently drift from what CI actually runs.
 *
 * Fail-closed by design: a missing ci-gate.json, a missing workflow, a malformed gate, or a
 * required check with no matching step is a failure. The `criticalPhaseExtra` checks are
 * deploy/critical-phase scope and are not part of the per-push gate.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PM_SCRIPT = /^(pnpm|npm|yarn)\s+(?:run\s+)?([A-Za-z0-9_:-]+)$/;

function normalize(command) {
  return command.replace(/\s+/g, ' ').trim();
}

export function packageScriptName(command) {
  const m = normalize(command).match(PM_SCRIPT);
  return m ? m[2] : null;
}

export function readWorkflowCommands(workflowPath) {
  if (!existsSync(workflowPath)) return null;
  const lines = readFileSync(workflowPath, 'utf8').split(/\r?\n/);
  const commands = [];
  let inBlock = false;
  let blockIndent = -1;
  for (const line of lines) {
    const indent = (line.match(/^\s*/) || [''])[0].length;
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed === '') continue;
      if (indent > blockIndent) {
        commands.push(trimmed);
        continue;
      }
      inBlock = false;
    }
    const m = line.match(/^\s*run:\s*(.*)$/);
    if (!m) continue;
    const rest = m[1].trim();
    if (rest === '' || rest === '|' || rest === '>') {
      inBlock = true;
      blockIndent = indent;
    } else {
      commands.push(rest);
    }
  }
  return commands.map(normalize).filter(Boolean);
}

export function resolveCheckPresent(check, packageJson, workflowCommands) {
  const command = normalize(check.command);
  const script = packageScriptName(command);

  if (command.startsWith('node ')) {
    return workflowCommands.includes(command);
  }

  if (!script) {
    return workflowCommands.includes(command);
  }

  const configured =
    packageJson &&
    typeof packageJson.scripts?.[script] === 'string' &&
    packageJson.scripts[script].trim() !== '';

  if (!configured && check.skipIfMissing) {
    return 'skipped';
  }

  const resolved = configured ? normalize(packageJson.scripts[script]) : null;

  for (const c of workflowCommands) {
    if (c === `node scripts/ci-run.mjs ${script}`) return true;
    if (c === command) return true;
    if (c === `npm run ${script}` || c === `npm ${script}`) return true;
    if (c === `pnpm run ${script}` || c === `pnpm ${script}`) return true;
    if (c === `yarn run ${script}` || c === `yarn ${script}`) return true;
    if (resolved && c.startsWith(resolved)) return true;
  }
  return false;
}

function pickWorkflow(root) {
  const flag = process.argv.indexOf('--workflow');
  if (flag !== -1 && process.argv[flag + 1]) {
    return resolve(root, process.argv[flag + 1]);
  }
  return join(root, '.github', 'workflows', 'oage-ci.yml');
}

function readPackageJson(root) {
  const manifest = join(root, 'package.json');
  if (!existsSync(manifest)) return null;
  try {
    return JSON.parse(readFileSync(manifest, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const root = process.cwd();
  const gatePath = join(root, '.opencode', 'governance', 'ci-gate.json');

  if (!existsSync(gatePath)) {
    console.error('[ci-gate] FAIL — .opencode/governance/ci-gate.json not found; the declared gate cannot be verified.');
    process.exit(1);
  }

  let gate;
  try {
    gate = JSON.parse(readFileSync(gatePath, 'utf8'));
  } catch (error) {
    console.error(`[ci-gate] FAIL — unreadable ci-gate.json: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(gate.required) || gate.required.length === 0) {
    console.error('[ci-gate] FAIL — ci-gate.json declares no required checks.');
    process.exit(1);
  }

  if (!Array.isArray(gate.failConditions) || gate.failConditions.length === 0) {
    console.error('[ci-gate] FAIL — ci-gate.json declares no failConditions.');
    process.exit(1);
  }

  const workflowPath = pickWorkflow(root);
  const commands = readWorkflowCommands(workflowPath);
  if (!commands) {
    console.error(`[ci-gate] FAIL — cannot read workflow ${workflowPath}.`);
    process.exit(1);
  }

  const packageJson = readPackageJson(root);
  const missing = [];
  let checked = 0;

  for (const check of gate.required) {
    if (!check || typeof check.id !== 'string' || typeof check.command !== 'string') {
      missing.push({ id: check?.id ?? '?', reason: 'malformed required entry: id and command must be strings' });
      continue;
    }
    checked += 1;
    const verdict = resolveCheckPresent(check, packageJson, commands);
    if (verdict === 'skipped') {
      console.log(`[ci-gate] SKIP ${check.id} — no ${packageScriptName(check.command)} script configured (skipIfMissing)`);
    } else if (verdict === true) {
      console.log(`[ci-gate] PASS ${check.id}`);
    } else {
      const where = relative(root, workflowPath);
      console.error(`[ci-gate] FAIL ${check.id} — "${check.command}" has no step in ${where}`);
      missing.push({ id: check.id, reason: `no matching step for "${check.command}"` });
    }
  }

  if (missing.length > 0) {
    console.error(`[ci-gate] FAIL — ${missing.length} required check(s) missing from the pipeline.`);
    process.exit(1);
  }

  console.log(`[ci-gate] PASS — all ${checked} required checks present in ${relative(root, workflowPath)}.`);
  process.exit(0);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
