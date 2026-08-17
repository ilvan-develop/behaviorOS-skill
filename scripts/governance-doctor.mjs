#!/usr/bin/env node

/**
 * behaviorOS - Governance Doctor (OAGE P1.0)
 *
 * Usage: node scripts/governance-doctor.mjs [--strict] [--json]
 *
 * Answers the question the 360 audit showed nothing was answering: for every policy, does the
 * chain Policy -> Consumer -> Enforcement -> Adversarial Test -> CI actually exist?
 *
 * The audit found 11 of 29 policy files with no runtime consumer while `validate.mjs` reported
 * 24/24 green — because validate only checks that a policy is well-formed JSON, never that
 * anything applies it. A policy nobody reads is documentation wearing a gate's name.
 *
 * This tool does not trust governance-contract.json. It reads the declaration, then greps the
 * codebase and reports where the two disagree:
 *
 *   BLOCKER  UNDECLARED_POLICY   a policy file with no contract entry
 *   BLOCKER  FALSE_ENFORCEMENT   declared "enforced", but no consumer actually references it
 *   BLOCKER  MISSING_CONSUMER    a declared consumer file does not exist
 *   BLOCKER  STALE_CONSUMER      the consumer exists but no longer references the policy
 *   BLOCKER  WRONG_MODE          declared runtime, but no .opencode/plugins file reads it
 *   BLOCKER  MISSING_TEST        a declared adversarial test does not exist
 *   WARNING  UNENFORCED_POLICY   honestly declared as a tracked gap (status: unenforced)
 *   WARNING  ORPHAN_CONTRACT     a contract entry with no policy file (unless optional)
 *   WARNING  UNTESTED_POLICY     enforced, fail-closed, but no adversarial test
 *
 * Exit codes: 0 if no blockers (warnings allowed), 1 if any blocker, 1 on any warning under
 * --strict. FALSE_ENFORCEMENT is the important one: it is the exact shape of the original bug,
 * where the system claimed authority it did not have.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BLOCKER = 'BLOCKER';
const WARNING = 'WARNING';

/** Files that can plausibly consume a policy, grouped by the authority they represent. */
function collectSourceFiles(root) {
  const roots = [
    '.opencode/plugins',
    'core',
    'scripts',
    'tests',
    '.github/workflows',
    'templates/base/ci',
  ];
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(p);
      } else if (/\.(mjs|js|ps1|yml|yaml)$/i.test(entry.name)) {
        out.push(p);
      }
    }
  };
  for (const r of roots) walk(join(root, r));
  return out;
}

const posix = (p) => p.split('\\').join('/');

/**
 * Does `source` reference the policy file `policy`?
 *
 * Needs a trailing boundary, because plain substring matching makes `audit.json` match
 * `audit.jsonl` — the audit LOG, not the audit CONFIG. That false positive credited
 * oage-lib.js as a consumer of audit.json and hid the real finding: nothing reads that
 * config at all, which is why its `retention` block never runs.
 */
export function referencesPolicy(source, policy) {
  const escaped = policy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}(?![A-Za-z0-9_])`).test(source);
}

/**
 * Build { policyFile: { runtime: [...], phase: [...], ci: [...], test: [...], other: [...] } }
 * from what the source files actually reference.
 */
export function deriveConsumers(root, policyFiles) {
  const sources = collectSourceFiles(root);
  const cache = new Map();
  const read = (f) => {
    if (!cache.has(f)) {
      try { cache.set(f, readFileSync(f, 'utf8')); } catch { cache.set(f, ''); }
    }
    return cache.get(f);
  };

  const classify = (rel) => {
    if (rel.startsWith('.opencode/plugins/')) return 'runtime';
    if (rel.startsWith('tests/')) return 'test';
    if (rel.includes('workflows/') || rel.includes('/ci/')) return 'ci';
    return 'other';
  };

  const map = {};
  for (const policy of policyFiles) {
    map[policy] = { runtime: [], test: [], ci: [], other: [] };
    for (const file of sources) {
      if (!referencesPolicy(read(file), policy)) continue;
      const rel = posix(relative(root, file));
      map[policy][classify(rel)].push(rel);
    }
  }
  return map;
}

/**
 * The contract ships into consumer projects, where `core/` and `templates/` do not exist — so
 * a declared toolchain consumer like core/generator.mjs is legitimately absent there, and
 * calling that a blocker would make every installed project fail its own doctor.
 *
 * "authoring" = the behaviorOS repo, where the contract is written and every declared consumer
 * must be real. "report" = an installed project, where only what ships can be verified.
 */
export function detectMode(root) {
  const isRepo = existsSync(join(root, 'core')) && existsSync(join(root, 'templates', 'base'));
  return isRepo ? 'authoring' : 'report';
}

/** Run every check. Returns { findings, rows, summary }. */
export function diagnose(root) {
  const mode = detectMode(root);
  const governanceDir = join(root, '.opencode', 'governance');
  const contractPath = join(governanceDir, 'governance-contract.json');

  if (!existsSync(contractPath)) {
    return {
      findings: [{
        level: BLOCKER,
        code: 'MISSING_CONTRACT',
        policy: '-',
        detail: 'No .opencode/governance/governance-contract.json — authority for every policy is undeclared.',
      }],
      rows: [],
      summary: { mode, policies: 0, enforced: 0, unenforced: 0, tested: 0, ciVerified: 0, blockers: 1, warnings: 0 },
    };
  }

  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const declared = contract.policies || {};

  const onDisk = existsSync(governanceDir)
    ? readdirSync(governanceDir).filter((f) => f.endsWith('.json') && f !== 'governance-contract.json')
    : [];

  const allPolicies = [...new Set([...onDisk, ...Object.keys(declared)])].sort();
  const consumers = deriveConsumers(root, allPolicies);

  const findings = [];
  const rows = [];
  const add = (level, code, policy, detail) => findings.push({ level, code, policy, detail });

  for (const policy of allPolicies) {
    const entry = declared[policy];
    const actual = consumers[policy] || { runtime: [], test: [], ci: [], other: [] };
    const actualAll = [...actual.runtime, ...actual.ci, ...actual.other];

    if (!entry) {
      add(BLOCKER, 'UNDECLARED_POLICY', policy,
        'Present in .opencode/governance/ but absent from the contract — nobody has declared who may apply it.');
      rows.push({ policy, authority: '?', mode: '?', consumer: actualAll[0] || '—', test: actual.test.length > 0, ci: actual.ci.length > 0, status: 'undeclared' });
      continue;
    }

    if (!onDisk.includes(policy)) {
      if (!entry.optional) {
        add(WARNING, 'ORPHAN_CONTRACT', policy, 'Declared in the contract but no such policy file exists.');
      }
      continue;
    }

    // Declared consumers must exist and must still reference the policy.
    for (const consumer of entry.consumers || []) {
      const abs = join(root, consumer);
      if (!existsSync(abs)) {
        // In an installed project a toolchain consumer is legitimately absent — see detectMode.
        if (mode === 'authoring') {
          add(BLOCKER, 'MISSING_CONSUMER', policy, `Declared consumer does not exist: ${consumer}`);
        }
        continue;
      }
      let src = '';
      try { src = readFileSync(abs, 'utf8'); } catch { /* unreadable — treat as stale below */ }
      if (!referencesPolicy(src, policy)) {
        add(BLOCKER, 'STALE_CONSUMER', policy,
          `${consumer} is declared as a consumer but no longer references ${policy}.`);
      }
    }

    // Declared adversarial tests must exist — but only where they live. behaviorOS's suite
    // proves behaviorOS's kernel; a consumer project inherits that guarantee from the package
    // and never receives tests/, so demanding them there would fail every install.
    if (mode === 'authoring') {
      for (const test of entry.adversarialTests || []) {
        if (!existsSync(join(root, test))) {
          add(BLOCKER, 'MISSING_TEST', policy, `Declared adversarial test does not exist: ${test}`);
        }
      }
    }

    if (entry.status === 'enforced') {
      if (actualAll.length === 0 && mode === 'authoring') {
        add(BLOCKER, 'FALSE_ENFORCEMENT', policy,
          'Declared "enforced" but no file in the codebase references it. This is the audited failure shape: authority claimed, never applied.');
      }
      if (entry.enforcementMode === 'runtime' && actual.runtime.length === 0) {
        add(BLOCKER, 'WRONG_MODE', policy,
          'Declared enforcementMode "runtime" but no .opencode/plugins file reads it — it cannot block a tool call.');
      }
      if (entry.failureMode === 'fail-closed' && (entry.adversarialTests || []).length === 0 && entry.authority !== 'declarative') {
        add(WARNING, 'UNTESTED_POLICY', policy,
          'Fail-closed and enforced, but no adversarial test proves the block actually happens.');
      }
    } else if (entry.status === 'unenforced') {
      add(WARNING, 'UNENFORCED_POLICY', policy,
        entry.note || 'Declared intent with no consumer. Tracked gap.');
    } else {
      add(BLOCKER, 'INVALID_STATUS', policy, `Unknown status "${entry.status}" — expected "enforced" or "unenforced".`);
    }

    rows.push({
      policy,
      authority: entry.authority || '?',
      mode: entry.enforcementMode || '?',
      consumer: (entry.consumers || [])[0]
        ? posix((entry.consumers || [])[0]).split('/').pop()
        : '—',
      test: (entry.adversarialTests || []).length > 0,
      ci: (entry.ci || []).length > 0 || actual.ci.length > 0,
      status: entry.status,
    });
  }

  const blockers = findings.filter((f) => f.level === BLOCKER).length;
  const warnings = findings.filter((f) => f.level === WARNING).length;

  return {
    findings,
    rows,
    summary: {
      mode,
      policies: rows.length,
      enforced: rows.filter((r) => r.status === 'enforced').length,
      unenforced: rows.filter((r) => r.status === 'unenforced').length,
      tested: rows.filter((r) => r.test).length,
      ciVerified: rows.filter((r) => r.ci).length,
      blockers,
      warnings,
    },
  };
}

function render({ findings, rows, summary }) {
  const pad = (s, n) => String(s).padEnd(n);
  const tick = (b) => (b ? 'yes' : '—');

  console.log('BEHAVIOROS GOVERNANCE DOCTOR');
  console.log(summary.mode === 'authoring'
    ? '  mode: authoring — every declared consumer must exist\n'
    : '  mode: report — installed project; toolchain consumers that do not ship are skipped\n');
  console.log(pad('Policy', 28), pad('Authority', 12), pad('Mode', 12), pad('Consumer', 24), pad('Test', 5), pad('CI', 4), 'Status');
  console.log('-'.repeat(100));
  for (const r of rows.sort((a, b) => a.authority.localeCompare(b.authority) || a.policy.localeCompare(b.policy))) {
    console.log(
      pad(r.policy.replace('.json', ''), 28),
      pad(r.authority, 12),
      pad(r.mode, 12),
      pad(r.consumer, 24),
      pad(tick(r.test), 5),
      pad(tick(r.ci), 4),
      r.status,
    );
  }

  if (findings.length) {
    console.log('\nFINDINGS\n');
    for (const level of [BLOCKER, WARNING]) {
      for (const f of findings.filter((x) => x.level === level)) {
        console.log(`${pad(level, 8)} ${pad(f.code, 20)} ${f.policy}`);
        console.log(`         ${f.detail}\n`);
      }
    }
  }

  console.log('RESULT');
  console.log(`  Policies:    ${summary.policies}`);
  console.log(`  Enforced:    ${summary.enforced}`);
  console.log(`  Unenforced:  ${summary.unenforced}`);
  console.log(`  Tested:      ${summary.tested}`);
  console.log(`  CI verified: ${summary.ciVerified}`);
  console.log(`  Blockers:    ${summary.blockers}`);
  console.log(`  Warnings:    ${summary.warnings}`);
}

function main() {
  const strict = process.argv.includes('--strict');
  const asJson = process.argv.includes('--json');
  const root = process.cwd();

  const result = diagnose(root);

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    render(result);
  }

  const { blockers, warnings } = result.summary;
  if (blockers > 0) {
    if (!asJson) console.log('\nGOVERNANCE CONTRACT INVALID');
    process.exit(1);
  }
  if (strict && warnings > 0) {
    if (!asJson) console.log('\nGOVERNANCE CONTRACT VALID, but --strict fails on tracked gaps');
    process.exit(1);
  }
  if (!asJson) console.log('\nGOVERNANCE CONTRACT VALID');
  process.exit(0);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
