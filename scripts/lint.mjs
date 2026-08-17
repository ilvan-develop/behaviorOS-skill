#!/usr/bin/env node

/**
 * behaviorOS - Lint / static governance checks
 *
 * Replaces the previous no-op "echo 'No linter configured'" stub. Runs checks that don't
 * need a full JS/TS toolchain (this repo ships governance config, not an app):
 *   1. JSON validity of every governance file (root + templates).
 *   2. Secret scan across the working tree (using anti-patterns.json's security category).
 *   3. Critical anti-pattern scan across the working tree.
 *
 * Flags: --secrets-only, --anti-patterns-only (used by CI, see templates/base/ci/oage-ci.yml).
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function checkJsonFiles(root, errors) {
  const govDirs = [join(root, '.opencode', 'governance')];
  const templatesDir = join(root, 'templates');
  if (existsSync(templatesDir)) {
    for (const t of readdirSync(templatesDir)) {
      const g = join(templatesDir, t, 'governance');
      if (existsSync(g)) govDirs.push(g);
    }
  }
  let checked = 0;
  for (const dir of govDirs) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      checked++;
      // Template source files use {{PLACEHOLDER}} tokens replaced at install time
      // (see core/generator.mjs) — substitute a JSON-safe stand-in before parsing.
      // Quoted placeholders ("{{X}}") become a quoted string; bare placeholders
      // (criticalPhases": {{X}}, replaced with JSON.stringify(array) at install time)
      // become an empty array.
      const raw = readFileSync(join(dir, file), 'utf8');
      const forParsing = raw
        .replace(/"\{\{[A-Z_]+\}\}"/g, '"__PLACEHOLDER__"')
        .replace(/\{\{[A-Z_]+\}\}/g, '[]');
      try {
        JSON.parse(forParsing);
      } catch (err) {
        errors.push(`Invalid JSON: ${relative(root, join(dir, file))} — ${err.message}`);
      }
    }
  }
  return checked;
}

function checkSecrets(root, errors) {
  const antiPatternsPath = join(root, '.opencode', 'governance', 'anti-patterns.json');
  const patterns = [];
  if (existsSync(antiPatternsPath)) {
    const ap = JSON.parse(readFileSync(antiPatternsPath, 'utf8'));
    for (const entry of ap.categories?.security || []) {
      if (entry.detection === 'regex' && entry.id.startsWith('sec-hardcoded')) {
        patterns.push({ id: entry.id, regex: new RegExp(entry.pattern, 'is'), message: entry.message });
      }
    }
  }
  if (patterns.length === 0) {
    patterns.push({
      id: 'sec-hardcoded-secret',
      regex: /(password|secret|token|api_key|apikey)\s*[:=]\s*['"][^'"]{4,}['"]/i,
      message: 'Possível segredo hardcoded',
    });
  }

  let scanned = 0;
  for (const file of walk(root)) {
    if (/\.(env|pem|key)$/i.test(file)) continue; // protected-resources.json already denies these
    // Test files are scanned like everything else. They used to be exempt — "fixture data
    // deliberately shaped like a secret, to test the scanner itself" — and that exemption let
    // a Stripe-shaped literal through to a push, which GitHub's push protection then rejected
    // while this scan reported clean. A secret in a test file is still a leaked secret, and no
    // fixture needs a scannable literal: assemble it at runtime instead (see the
    // sec-hardcoded-secret test in tests/oage-gates.test.js).
    if (!/\.(js|mjs|ts|tsx|jsx|json|yml|yaml|env\.example)$/i.test(file)) continue;
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    scanned++;
    for (const p of patterns) {
      if (p.regex.test(content)) {
        errors.push(`${p.message} [${p.id}]: ${relative(root, file)}`);
      }
    }
  }
  return scanned;
}

function checkAntiPatterns(root, errors) {
  const antiPatternsPath = join(root, '.opencode', 'governance', 'anti-patterns.json');
  if (!existsSync(antiPatternsPath)) return 0;
  const ap = JSON.parse(readFileSync(antiPatternsPath, 'utf8'));
  const critical = [];
  for (const [category, entries] of Object.entries(ap.categories || {})) {
    for (const entry of entries) {
      if (entry.detection === 'regex' && entry.severity === 'critical') {
        // 's' (dotAll): see .opencode/plugins/oage-enforce.js's identical fix — without it,
        // db-missing-tenant-isolation's negative lookahead only sees up to the next newline,
        // so any normally-formatted multi-line `findMany({ where: { ... organizationId } })`
        // false-positives here too, exactly like the live-observed runtime bug this mirrors.
        critical.push({ ...entry, category, regex: new RegExp(entry.pattern, 'is') });
      }
    }
  }

  let scanned = 0;
  for (const file of walk(root)) {
    if (/\.test\.(js|mjs|ts)$/i.test(file)) continue; // fixture data, not shipped code
    if (!/\.(js|mjs|ts|tsx|jsx|prisma)$/i.test(file)) continue;
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    scanned++;
    for (const c of critical) {
      if (c.appliesTo && c.appliesTo !== '*' && !file.endsWith(c.appliesTo.replace('*', ''))) continue;
      if (c.regex.test(content)) {
        errors.push(`Anti-pattern crítico "${c.name}" [${c.id}]: ${relative(root, file)}`);
      }
    }
  }
  return scanned;
}

function main() {
  const root = process.cwd();
  const secretsOnly = process.argv.includes('--secrets-only');
  const antiPatternsOnly = process.argv.includes('--anti-patterns-only');
  const errors = [];
  let summary = [];

  if (!antiPatternsOnly) {
    const checked = checkJsonFiles(root, errors);
    summary.push(`JSON governance files checked: ${checked}`);
  }

  if (!antiPatternsOnly) {
    const scanned = checkSecrets(root, errors);
    summary.push(`Files scanned for secrets: ${scanned}`);
  }

  if (!secretsOnly) {
    const scanned = checkAntiPatterns(root, errors);
    summary.push(`Files scanned for critical anti-patterns: ${scanned}`);
  }

  console.log('=== behaviorOS lint ===');
  summary.forEach((s) => console.log(s));
  console.log('');

  if (errors.length > 0) {
    console.error(`FAILED (${errors.length} issue(s)):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('OK — no issues found.');
}

main();
