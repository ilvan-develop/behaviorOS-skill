#!/usr/bin/env node

/**
 * behaviorOS - OAGE gap-closing tests
 *
 * Covers the additions made to close the OAGE-vs-behaviorOS gap analysis: shared
 * governance files, install-time propagation (plugins/commands/CI/shared governance),
 * and the evidence/reviewer/dependency mechanical gates.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { installFromTemplate } from '../core/installer.mjs';
import { matchesAny, matchesCommand } from '../.opencode/plugins/lib/oage-lib.js';
import { pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const SHARED_GOVERNANCE_FILES = [
  'anti-patterns.json',
  'protected-resources.json',
  'loop-detector.json',
  'dependency-gate.json',
  'truth-gate.json',
  'reviewer-gate.json',
  'mcp-registry.json',
  'handoff-schema.json',
  'definition-of-done.json',
  'ci-gate.json',
];

describe('OAGE shared governance sources', () => {
  it('should have all shared governance files as valid JSON', () => {
    const dir = join(ROOT_DIR, 'templates', 'base', 'governance');
    for (const file of SHARED_GOVERNANCE_FILES) {
      const path = join(dir, file);
      assert.ok(existsSync(path), `Missing shared governance file: ${file}`);
      assert.doesNotThrow(() => JSON.parse(readFileSync(path, 'utf8')), `${file} is not valid JSON`);
    }
  });

  it('should have OAGE-RULES.md', () => {
    const path = join(ROOT_DIR, 'templates', 'base', 'governance', 'OAGE-RULES.md');
    assert.ok(existsSync(path));
    assert.ok(readFileSync(path, 'utf8').includes('Regras OAGE Adicionais'));
  });

  it('should have the installable CI workflow', () => {
    assert.ok(existsSync(join(ROOT_DIR, 'templates', 'base', 'ci', 'oage-ci.yml')));
  });

  it('should have both runtime enforcement plugins', () => {
    assert.ok(existsSync(join(ROOT_DIR, '.opencode', 'plugins', 'oage-enforce.js')));
    assert.ok(existsSync(join(ROOT_DIR, '.opencode', 'plugins', 'oage-audit.js')));
  });

  it('should have all five OAGE diagnostic commands', () => {
    for (const cmd of ['oage-doctor', 'oage-audit', 'oage-review', 'oage-research', 'oage-release']) {
      assert.ok(existsSync(join(ROOT_DIR, '.opencode', 'commands', `${cmd}.md`)), `Missing command: ${cmd}`);
    }
  });
});

describe('Glob matcher used by protected-resources.json / truth-gate.json', () => {
  it('should match protected-resource patterns including root-level dotfiles', () => {
    assert.strictEqual(matchesAny('.env', ['**/.env', '**/.env.*', '!**/.env.example']), true);
    assert.strictEqual(matchesAny('apps/api/.env', ['**/.env', '**/.env.*', '!**/.env.example']), true);
    assert.strictEqual(matchesAny('.env.example', ['**/.env', '**/.env.*', '!**/.env.example']), false);
    assert.strictEqual(matchesAny('secrets/aws.json', ['**/secrets/**']), true);
    assert.strictEqual(matchesAny('apps/api/secrets/aws.json', ['**/secrets/**']), true);
    assert.strictEqual(matchesAny('.ssh/id_rsa', ['**/.ssh/**']), true);
  });

  it('should match truth-gate critical file patterns without false-positiving unrelated files', () => {
    assert.strictEqual(matchesAny('db/schema.prisma', ['*.prisma']), true);
    assert.strictEqual(matchesAny('src/payment/service.ts', ['**/payment*/**']), true);
    assert.strictEqual(matchesAny('src/foo/service.ts', ['*.prisma', '**/migrations/**', '**/payment*/**']), false);
  });
});

describe('Command matcher used by dependency-gate.json', () => {
  const patterns = ['npm install *', 'npm i *', 'pnpm add *', 'yarn add *'];
  const exempt = ['* install', '* install --frozen-lockfile', '* i --frozen-lockfile'];

  it('should catch scoped packages (regression: globToRegExp excludes "/" by design for paths)', () => {
    assert.strictEqual(matchesCommand('npm install @nestjs/core', patterns), true);
    assert.strictEqual(matchesCommand('pnpm add @nestjs/core', patterns), true);
  });

  it('should not flag a bare lockfile install as a new dependency', () => {
    assert.strictEqual(matchesCommand('npm install', exempt), true);
    assert.strictEqual(matchesCommand('pnpm install --frozen-lockfile', exempt), true);
    assert.strictEqual(matchesCommand('npm install ioredis', exempt), false);
  });
});

describe('Install-time propagation', () => {
  const testDir = join(__dirname, 'test-oage-install');

  function cleanup() {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }

  it('should copy shared governance, plugins, commands and CI workflow into a fresh install', () => {
    cleanup();
    mkdirSync(testDir, { recursive: true });

    const result = installFromTemplate({
      template: 'saas-b2b',
      projectName: 'test-project',
      projectDescription: 'Test project',
      criticalPhases: ['F2', 'F3'],
      targetDir: testDir,
    });

    assert.strictEqual(result.success, true, JSON.stringify(result));

    for (const file of SHARED_GOVERNANCE_FILES) {
      const path = join(testDir, '.opencode', 'governance', file);
      assert.ok(existsSync(path), `Shared file not installed: ${file}`);
    }

    assert.ok(existsSync(join(testDir, '.opencode', 'plugins', 'oage-enforce.js')));
    assert.ok(existsSync(join(testDir, '.opencode', 'plugins', 'oage-audit.js')));
    assert.ok(existsSync(join(testDir, '.opencode', 'plugins', 'lib', 'oage-lib.js')));
    assert.ok(existsSync(join(testDir, '.opencode', 'commands', 'oage-doctor.md')));
    assert.ok(existsSync(join(testDir, '.github', 'workflows', 'oage-ci.yml')));

    const instructions = readFileSync(join(testDir, '.opencode', 'governance', 'INSTRUCTIONS.md'), 'utf8');
    assert.ok(instructions.includes('Regras OAGE Adicionais'), 'INSTRUCTIONS.md missing appended OAGE rules');

    cleanup();
  });
});

describe('Real CLI entrypoints (scripts/install.mjs, scripts/init.mjs)', () => {
  // Regression guard: core/installer.mjs was, for a while, only exercised by tests and by
  // whatever imported it directly — scripts/install.mjs and scripts/init.mjs each had their
  // own ~200-line duplicated copy logic that never called core/ and never got the OAGE
  // additions (plugins, shared governance, CI, blueprint README). This suite spawns the real
  // CLI as a user would run it, so drift between "the library" and "what ships" can't recur
  // silently.
  const cliTestDir = join(__dirname, 'test-cli-install');

  function cleanup() {
    if (existsSync(cliTestDir)) rmSync(cliTestDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }

  it('install.mjs --template installs the full OAGE layer, not just the original 10 files', () => {
    cleanup();
    mkdirSync(cliTestDir, { recursive: true });

    const result = spawnSync('node', [join(ROOT_DIR, 'scripts', 'install.mjs'), '--template=saas-b2b'], {
      cwd: cliTestDir,
      encoding: 'utf8',
      env: { ...process.env, PROJECT_NAME: 'cli-test', PROJECT_DESCRIPTION: 'CLI test project' },
    });

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    assert.ok(existsSync(join(cliTestDir, 'opencode.json')), 'opencode.json missing from project root');
    assert.ok(existsSync(join(cliTestDir, '.opencode', 'plugins', 'oage-enforce.js')), 'runtime enforcement plugin missing from real CLI install');
    assert.ok(existsSync(join(cliTestDir, '.opencode', 'commands', 'oage-doctor.md')), 'diagnostic commands missing from real CLI install');
    assert.ok(existsSync(join(cliTestDir, '.github', 'workflows', 'oage-ci.yml')), 'CI workflow missing from real CLI install');
    assert.ok(existsSync(join(cliTestDir, '.opencode', 'blueprint', 'README.md')), 'blueprint README missing from real CLI install');

    const config = JSON.parse(readFileSync(join(cliTestDir, 'opencode.json'), 'utf8'));
    assert.strictEqual(config.project, 'cli-test');
    assert.strictEqual(config.description, 'CLI test project');

    cleanup();
  });

  it('install.mjs --blueprint actually installs (used to be an unimplemented TODO)', () => {
    cleanup();
    mkdirSync(cliTestDir, { recursive: true });

    const blueprintDir = join(ROOT_DIR, 'templates', 'marketplace', 'blueprint');
    const result = spawnSync('node', [join(ROOT_DIR, 'scripts', 'install.mjs'), `--blueprint=${blueprintDir}`], {
      cwd: cliTestDir,
      encoding: 'utf8',
    });

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    assert.ok(existsSync(join(cliTestDir, 'opencode.json')), 'blueprint install did not produce opencode.json');
    assert.ok(existsSync(join(cliTestDir, '.opencode', 'plugins', 'oage-enforce.js')), 'blueprint install did not produce the runtime enforcement plugin');

    cleanup();
  });

  it('install.mjs rejects an unknown template with a clear error, not a silent partial install', () => {
    cleanup();
    mkdirSync(cliTestDir, { recursive: true });

    const result = spawnSync('node', [join(ROOT_DIR, 'scripts', 'install.mjs'), '--template=not-a-real-template'], {
      cwd: cliTestDir,
      encoding: 'utf8',
    });

    assert.notStrictEqual(result.status, 0);
    assert.ok(!existsSync(join(cliTestDir, 'opencode.json')), 'should not have written any files for an invalid template');

    cleanup();
  });
});

describe('Evidence-based completion gate (scripts/evidence-check.mjs)', () => {
  const testDir = join(__dirname, 'test-evidence-gate');

  function cleanup() {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }

  function run(args) {
    return spawnSync('node', [join(ROOT_DIR, 'scripts', 'evidence-check.mjs'), ...args], {
      cwd: testDir,
      encoding: 'utf8',
    });
  }

  it('should block when no definition-of-done.json exists (permissive fallback) vs. block on missing evidence file when it does', () => {
    cleanup();
    mkdirSync(join(testDir, '.opencode', 'governance'), { recursive: true });

    // No definition-of-done.json -> permissive (warn, exit 0)
    let result = run(['--phase', 'F2']);
    assert.strictEqual(result.status, 0);

    // With definition-of-done.json present but no evidence file -> blocks
    const dod = JSON.parse(readFileSync(join(ROOT_DIR, 'templates', 'base', 'governance', 'definition-of-done.json'), 'utf8'));
    writeFileSync(join(testDir, '.opencode', 'governance', 'definition-of-done.json'), JSON.stringify(dod));
    result = run(['--phase', 'F2']);
    assert.strictEqual(result.status, 1);

    cleanup();
  });

  it('should pass when evidence file has all required fields', () => {
    cleanup();
    mkdirSync(join(testDir, '.opencode', 'governance'), { recursive: true });
    mkdirSync(join(testDir, '.opencode', 'evidence'), { recursive: true });

    const dod = JSON.parse(readFileSync(join(ROOT_DIR, 'templates', 'base', 'governance', 'definition-of-done.json'), 'utf8'));
    writeFileSync(join(testDir, '.opencode', 'governance', 'definition-of-done.json'), JSON.stringify(dod));

    const evidence = {
      filesChanged: ['src/foo.ts'],
      testsRun: 'vitest run',
      testResults: 'passed',
      buildResult: 'success',
      lintResult: 'clean',
      typecheckResult: 'clean',
    };
    writeFileSync(join(testDir, '.opencode', 'evidence', 'F2.json'), JSON.stringify(evidence));

    const result = run(['--phase', 'F2']);
    assert.strictEqual(result.status, 0, result.stderr);

    cleanup();
  });
});

describe('Dependency justification (scripts/audit-event.mjs)', () => {
  const testDir = join(__dirname, 'test-audit-event');

  function cleanup() {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }

  it('should append a structured event to audit.jsonl', () => {
    cleanup();
    mkdirSync(testDir, { recursive: true });

    const result = spawnSync(
      'node',
      [join(ROOT_DIR, 'scripts', 'audit-event.mjs'), '--event', 'dependency_justification', '--agent', 'backend', '--package', 'ioredis', '--why', 'cache'],
      { cwd: testDir, encoding: 'utf8' }
    );
    assert.strictEqual(result.status, 0, result.stderr);

    const logPath = join(testDir, '.opencode', 'audit', 'audit.jsonl');
    assert.ok(existsSync(logPath));
    const record = JSON.parse(readFileSync(logPath, 'utf8').trim());
    assert.strictEqual(record.event, 'dependency_justification');
    assert.strictEqual(record.package, 'ioredis');

    cleanup();
  });
});

// Regression tests for real bugs found by dogfooding a full fintech install end to end
// (see conversation: "executa um teste fintech enterprise ... aplica de forma real").
describe('Dogfood-found regressions', () => {
  const testDir = join(__dirname, 'test-dogfood-install');

  function cleanup() {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }

  it('install must include agent-loop.ps1, run-pipeline.ps1, gates.ps1 and validate.mjs (dropped when install.mjs/init.mjs were refactored onto core/generator.mjs)', () => {
    cleanup();
    mkdirSync(testDir, { recursive: true });
    const result = installFromTemplate({ template: 'fintech', projectName: 'dogfood', targetDir: testDir });
    assert.strictEqual(result.success, true, JSON.stringify(result));

    for (const file of ['agent-loop.ps1', 'run-pipeline.ps1', 'gates.ps1', 'log-skill-selection.ps1', 'validate.mjs', 'reviewer-check.mjs']) {
      assert.ok(existsSync(join(testDir, 'scripts', file)), `Missing scripts/${file} — a real "node scripts/validate.mjs" run in an installed project would crash without it`);
    }

    cleanup();
  });

  it('every template\'s permissions-matrix.json has autonomyLevels+rules and audit.json has capture.skillSelectionLog (found live: only fintech had these — the other 7 templates failed scripts/validate.mjs the moment they were installed for a real project)', () => {
    const ALL_TEMPLATES = ['custom', 'ecommerce', 'education', 'fintech', 'healthcare', 'marketplace', 'saas-b2b', 'saas-b2c'];
    for (const t of ALL_TEMPLATES) {
      const pm = JSON.parse(readFileSync(join(ROOT_DIR, 'templates', t, 'governance', 'permissions-matrix.json'), 'utf8'));
      assert.ok(pm.autonomyLevels && pm.autonomyLevels.L1 && pm.autonomyLevels.L2 && pm.autonomyLevels.L3, `${t}: permissions-matrix.json missing autonomyLevels.{L1,L2,L3}`);
      assert.ok(pm.rules && Object.keys(pm.rules).length > 0, `${t}: permissions-matrix.json missing rules`);

      const audit = JSON.parse(readFileSync(join(ROOT_DIR, 'templates', t, 'governance', 'audit.json'), 'utf8'));
      assert.ok(audit.capture?.skillSelectionLog, `${t}: audit.json missing capture.skillSelectionLog`);
    }
  });

  it('templates without their own AGENTS.md (e.g. saas-b2b) must still get one at project root, falling back to templates/base/governance/AGENTS.md (previously silently skipped — see core/generator.mjs rootFiles loop)', () => {
    cleanup();
    mkdirSync(testDir, { recursive: true });

    assert.ok(
      !existsSync(join(ROOT_DIR, 'templates', 'saas-b2b', 'governance', 'AGENTS.md')),
      'this test assumes saas-b2b has no template-specific AGENTS.md — if it now does, the fallback path this test covers is no longer exercised'
    );

    const result = installFromTemplate({ template: 'saas-b2b', projectName: 'dogfood-saas', targetDir: testDir });
    assert.strictEqual(result.success, true, JSON.stringify(result));

    const agentsPath = join(testDir, 'AGENTS.md');
    assert.ok(existsSync(agentsPath), 'AGENTS.md missing from project root for a template with no template-specific AGENTS.md');

    const content = readFileSync(agentsPath, 'utf8');
    assert.ok(content.includes('dogfood-saas'), 'AGENTS.md placeholders were not substituted');
    assert.ok(!content.includes('{{'), 'AGENTS.md still has unsubstituted {{...}} placeholders');

    cleanup();
  });

  it('anti-pattern secret regex must be case-insensitive (camelCase "apiKey" bypassed the original pattern, which only covered "api_key"/"apikey")', () => {
    const ap = JSON.parse(readFileSync(join(ROOT_DIR, 'templates', 'base', 'governance', 'anti-patterns.json'), 'utf8'));
    const entry = ap.categories.security.find((e) => e.id === 'sec-hardcoded-secret');
    const re = new RegExp(entry.pattern, 'i');

    // Assembled at runtime so no provider-shaped literal — nor a literal `name = "…"`
    // assignment, which sec-hardcoded-secret also matches — exists in this file. Spelled out,
    // it was a real leak: GitHub push protection rejects the push on "Stripe API Key".
    const stripeShaped = ['sk', 'live', `51H8xJ2KZQvGyD${'x'.repeat(13)}`].join('_');
    const assignment = (name) => `const ${name} = "${stripeShaped}";`;

    assert.ok(re.test(assignment('apiKey')), 'camelCase apiKey should be caught');
    assert.ok(re.test(assignment('api_key')), 'snake_case api_key should still be caught');
  });

  it('reviewer-check.mjs must recognize implementers logged by scripts/audit-logger.ps1 (event:"tool_call"), not just the Node plugin (event:"tool_executed") — otherwise self-approval detection silently does nothing under the Rule-16 enforce.ps1 path, which is how real usage logs writes today', () => {
    cleanup();
    mkdirSync(join(testDir, '.opencode', 'governance'), { recursive: true });
    mkdirSync(join(testDir, '.opencode', 'audit'), { recursive: true });
    writeFileSync(
      join(testDir, '.opencode', 'governance', 'reviewer-gate.json'),
      readFileSync(join(ROOT_DIR, 'templates', 'base', 'governance', 'reviewer-gate.json'))
    );

    const selfApprovalOnly = [
      { timestamp: new Date().toISOString(), event: 'tool_call', tool: 'write', agent: 'backend', phase: 'F2', result: 'PASS' },
      { timestamp: new Date().toISOString(), event: 'review_approved', agent: 'backend', phase: 'F2', reviewedBy: 'backend' },
    ];
    writeFileSync(join(testDir, '.opencode', 'audit', 'audit.jsonl'), selfApprovalOnly.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const blocked = spawnSync('node', [join(ROOT_DIR, 'scripts', 'reviewer-check.mjs'), '--phase', 'F2'], { cwd: testDir, encoding: 'utf8' });
    assert.strictEqual(blocked.status, 1, 'pure self-approval via the PS1 audit schema should be blocked, not silently accepted');

    // Now an independent reviewer approves too — should pass, and the "PASS" gate on a
    // BLOCKED tool_call must not falsely count as an implementation.
    const withIndependentReview = [
      { timestamp: new Date().toISOString(), event: 'tool_call', tool: 'write', agent: 'backend', phase: 'F2', result: 'BLOCKED' },
      { timestamp: new Date().toISOString(), event: 'tool_call', tool: 'write', agent: 'backend', phase: 'F2', result: 'PASS' },
      { timestamp: new Date().toISOString(), event: 'review_approved', agent: 'qa', phase: 'F2', reviewedBy: 'qa' },
    ];
    writeFileSync(join(testDir, '.opencode', 'audit', 'audit.jsonl'), withIndependentReview.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const passed = spawnSync('node', [join(ROOT_DIR, 'scripts', 'reviewer-check.mjs'), '--phase', 'F2'], { cwd: testDir, encoding: 'utf8' });
    assert.strictEqual(passed.status, 0, passed.stderr || passed.stdout);
    assert.ok(passed.stdout.includes('backend'), 'the PASSed tool_call from backend should be detected as an implementer');

    cleanup();
  });

  it('risk-engine.js/policy-resolver.js must not cache governance JSON at module scope — the OpenCode host loads a plugin once and keeps it resident for the whole session, so a stale in-memory cache silently freezes risk/policy at whatever they were on the first tool call, never picking up a mid-session state-machine.json phase change (live-observed: /agent_loop advancing past F0 never actually escalated risk for the rest of a long session)', async () => {
    cleanup();
    mkdirSync(testDir, { recursive: true });
    const result = installFromTemplate({ template: 'fintech', projectName: 'cache-proof', targetDir: testDir });
    assert.strictEqual(result.success, true, JSON.stringify(result));

    const { OageEnforce } = await import(pathToFileURL(join(testDir, '.opencode', 'plugins', 'oage-enforce.js')));
    const enforce = await OageEnforce({ directory: testDir, worktree: testDir }); // one instance for this whole test, like one real session

    async function riskFor(target, sessionID) {
      try {
        await enforce['tool.execute.before'](
          { tool: 'write', sessionID, callID: 'c' },
          { args: { filePath: target, content: 'export class X {}' } },
        );
        return 'ALLOWED';
      } catch (e) {
        return e.message;
      }
    }

    const smPath = join(testDir, '.opencode', 'governance', 'state-machine.json');
    const sm = JSON.parse(readFileSync(smPath, 'utf8'));
    assert.strictEqual(sm.currentState, 'F0');

    // Baseline read while still on F0 — this is what a stale cache would freeze on.
    await riskFor('src/foo.service.ts', 'session-a');

    // Simulate /agent_loop advancing the phase mid-session, exactly like state-manager.ps1
    // rewriting currentState on disk without restarting the plugin process.
    sm.currentState = 'F2'; // isCritical: true in the fintech template
    writeFileSync(smPath, JSON.stringify(sm, null, 2));

    const afterAdvance = await riskFor('src/bar.service.ts', 'session-b');
    // Also proves risk-escalation itself: edit-service alone is HIGH; a critical phase must
    // escalate it one level to CRITICAL per behavior-contract.json's riskEscalation rules
    // (previously capped at HIGH regardless of phase criticality).
    assert.ok(/risk: CRITICAL/.test(afterAdvance), `Expected CRITICAL after phase change to F2, got: ${afterAdvance}`);

    cleanup();
  });
});
