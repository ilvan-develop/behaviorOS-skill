#!/usr/bin/env node

/**
 * behaviorOS - Configuration Validation Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { validateGovernance, validateConfig } from '../core/validator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

describe('behaviorOS Configuration Validator', () => {
  const testDir = join(__dirname, 'test-output');
  const governanceDir = join(testDir, '.opencode', 'governance');

  // Setup test directory
  function setupTestDir() {
    if (!existsSync(governanceDir)) {
      mkdirSync(governanceDir, { recursive: true });
    }
  }

  // Cleanup test directory
  function cleanupTestDir() {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  }

  // Create test file
  function createTestFile(filename, content) {
    const filePath = join(governanceDir, filename);
    writeFileSync(filePath, content);
    return filePath;
  }

  describe('validateGovernance', () => {
    it('should return errors for missing required files', () => {
      setupTestDir();
      
      const result = validateGovernance(governanceDir);
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors.some(e => e.includes('Missing required file')));
      
      cleanupTestDir();
    });

    it('should pass for valid governance configuration', () => {
      setupTestDir();
      
      // Create required files
      createTestFile('opencode.json', JSON.stringify({
        project: 'test-project',
        agents: {},
        governance: { enabled: true },
      }));
      
      createTestFile('INSTRUCTIONS.md', '# Test Instructions');
      
      createTestFile('permissions-matrix.json', JSON.stringify({
        autonomyLevels: { L1: {}, L2: {}, L3: {} },
        rules: {},
      }));
      
      createTestFile('skill-gate.json', JSON.stringify({
        rules: [],
        requiredSkills: {},
      }));
      
      createTestFile('tool-gate.json', JSON.stringify({
        rules: [],
      }));
      
      createTestFile('state-machine.json', JSON.stringify({
        initialState: 'idle',
        states: {},
      }));
      
      createTestFile('memory.json', JSON.stringify({
        sections: {},
      }));
      
      createTestFile('audit.json', JSON.stringify({
        enabled: true,
      }));
      
      const result = validateGovernance(governanceDir);
      
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
      assert.ok(result.files.present.length > 0);
      
      cleanupTestDir();
    });

    it('should warn about missing optional files', () => {
      setupTestDir();
      
      // Create only required files
      createTestFile('opencode.json', JSON.stringify({ project: 'test' }));
      createTestFile('INSTRUCTIONS.md', '# Test');
      createTestFile('permissions-matrix.json', JSON.stringify({}));
      createTestFile('skill-gate.json', JSON.stringify({}));
      createTestFile('tool-gate.json', JSON.stringify({}));
      createTestFile('state-machine.json', JSON.stringify({}));
      createTestFile('memory.json', JSON.stringify({}));
      createTestFile('audit.json', JSON.stringify({}));
      
      const result = validateGovernance(governanceDir);
      
      assert.ok(result.warnings.some(w => w.includes('Optional file not present')));
      
      cleanupTestDir();
    });
  });

  describe('validateConfig', () => {
    it('should validate opencode.json configuration', () => {
      setupTestDir();
      
      createTestFile('opencode.json', JSON.stringify({
        project: 'test-project',
        agents: { backend: {} },
        governance: { enabled: true },
      }));
      
      const result = validateConfig(governanceDir, 'opencode');
      
      assert.strictEqual(result.valid, true);
      
      cleanupTestDir();
    });

    it('should fail for invalid opencode.json', () => {
      setupTestDir();
      
      createTestFile('opencode.json', JSON.stringify({
        // Missing required fields
      }));
      
      const result = validateConfig(governanceDir, 'opencode');
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('Missing'));
      
      cleanupTestDir();
    });

    it('should validate permissions-matrix.json', () => {
      setupTestDir();
      
      createTestFile('permissions-matrix.json', JSON.stringify({
        autonomyLevels: { L1: {}, L2: {}, L3: {} },
        rules: {},
      }));
      
      const result = validateConfig(governanceDir, 'permissions-matrix');
      
      assert.strictEqual(result.valid, true);
      
      cleanupTestDir();
    });
  });
});
