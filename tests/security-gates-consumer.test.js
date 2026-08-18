#!/usr/bin/env node

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const LINT = join(ROOT_DIR, 'scripts', 'lint.mjs');

describe('security-gates.json has a consumer: scripts/lint.mjs', () => {
  it('lint.mjs references security-gates.json and exposes the gate scan', () => {
    const lint = readFileSync(LINT, 'utf8');
    assert.match(lint, /security-gates\.json/, 'lint.mjs must reference security-gates.json');
    assert.match(lint, /function checkSecurityGates/, 'lint.mjs must expose the gate scan');
  });

  it('enforces a declared gate end to end', () => {
    const scanDir = join(tmpdir(), `oage-security-gates-${process.pid}`);
    const wipe = () => {
      if (existsSync(scanDir)) rmSync(scanDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    };
    wipe();
    mkdirSync(join(scanDir, '.opencode', 'governance'), { recursive: true });
    mkdirSync(join(scanDir, 'src'), { recursive: true });
    writeFileSync(
      join(scanDir, '.opencode', 'governance', 'anti-patterns.json'),
      readFileSync(join(ROOT_DIR, 'templates', 'base', 'governance', 'anti-patterns.json')),
    );
    writeFileSync(
      join(scanDir, '.opencode', 'governance', 'security-gates.json'),
      readFileSync(join(ROOT_DIR, '.opencode', 'governance', 'security-gates.json')),
    );
    writeFileSync(
      join(scanDir, 'src', 'payments.service.ts'),
      'const list = prisma.payment.findMany({ where: { userId: 1 } });\n',
    );

    const result = spawnSync(process.execPath, [LINT, '--anti-patterns-only'], { cwd: scanDir, encoding: 'utf8' });
    assert.notEqual(result.status, 0, 'a tenant-isolation violation must fail the gate scan');
    assert.match(`${result.stdout}${result.stderr}`, /\[tenant-isolation\]/);
    wipe();
  });

  it('falls back tolerantly when security-gates.json is absent', () => {
    const scanDir = join(tmpdir(), `oage-security-gates-none-${process.pid}`);
    const wipe = () => {
      if (existsSync(scanDir)) rmSync(scanDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    };
    wipe();
    mkdirSync(join(scanDir, '.opencode', 'governance'), { recursive: true });
    writeFileSync(
      join(scanDir, '.opencode', 'governance', 'anti-patterns.json'),
      readFileSync(join(ROOT_DIR, 'templates', 'base', 'governance', 'anti-patterns.json')),
    );
    writeFileSync(join(scanDir, 'src.ts'), 'export const ok = 1;\n');

    const result = spawnSync(process.execPath, [LINT, '--anti-patterns-only'], { cwd: scanDir, encoding: 'utf8' });
    assert.equal(result.status, 0, 'missing security-gates.json must not fail the scan');
    wipe();
  });
});
