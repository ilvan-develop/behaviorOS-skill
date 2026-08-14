#!/usr/bin/env node

/**
 * behaviorOS - Configuration Validation Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { validateGovernance, validateConfig } from '../core/validator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const TEMPLATES_DIR = join(ROOT_DIR, 'templates');

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
        matrix: {},
      }));
      
      createTestFile('skill-gate.json', JSON.stringify({
        phases: {},
      }));
      
      createTestFile('tool-gate.json', JSON.stringify({
        rules: [],
      }));
      
      createTestFile('state-machine.json', JSON.stringify({
        states: [],
        transitions: [],
      }));
      
      createTestFile('memory.json', JSON.stringify({
        sections: [],
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

  describe('Template Validation', () => {
    const templates = ['fintech', 'saas-b2b', 'saas-b2c', 'ecommerce', 'marketplace', 'healthcare', 'education', 'custom'];

    templates.forEach(template => {
      describe(`${template} template`, () => {
        it('should have all required governance files', () => {
          const templateDir = join(TEMPLATES_DIR, template, 'governance');
          
          if (!existsSync(templateDir)) {
            console.log(`Skipping ${template} - directory not found`);
            return;
          }

          const requiredFiles = [
            'opencode.json',
            'INSTRUCTIONS.md',
            'permissions-matrix.json',
            'skill-gate.json',
            'tool-gate.json',
            'state-machine.json',
            'memory.json',
            'audit.json',
            'security-gates.json',
            'production-gate.json'
          ];

          const missingFiles = requiredFiles.filter(file => !existsSync(join(templateDir, file)));
          
          assert.strictEqual(missingFiles.length, 0, `Missing files in ${template}: ${missingFiles.join(', ')}`);
        });

        it('should have valid opencode.json', () => {
          const templateDir = join(TEMPLATES_DIR, template, 'governance');
          
          if (!existsSync(templateDir)) {
            console.log(`Skipping ${template} - directory not found`);
            return;
          }

          const opencodePath = join(templateDir, 'opencode.json');
          
          if (!existsSync(opencodePath)) {
            console.log(`Skipping ${template} - opencode.json not found`);
            return;
          }

          const content = readFileSync(opencodePath, 'utf-8');
          const config = JSON.parse(content);

          assert.ok(config.project, `${template}: Missing project field`);
          assert.ok(config.agents, `${template}: Missing agents field`);
          assert.ok(config.governance, `${template}: Missing governance field`);
          assert.ok(config.governance.enabled !== undefined, `${template}: Missing governance.enabled`);
          assert.ok(config.governance.parallelExecution !== undefined, `${template}: Missing governance.parallelExecution`);
          assert.ok(config.governance.immutableRules, `${template}: Missing governance.immutableRules`);
          assert.ok(Array.isArray(config.governance.immutableRules), `${template}: governance.immutableRules should be an array`);
          assert.ok(config.governance.immutableRules.length >= 6, `${template}: governance.immutableRules should have at least 6 rules`);
        });

        it('should have valid INSTRUCTIONS.md with immutable rules', () => {
          const templateDir = join(TEMPLATES_DIR, template, 'governance');
          
          if (!existsSync(templateDir)) {
            console.log(`Skipping ${template} - directory not found`);
            return;
          }

          const instructionsPath = join(templateDir, 'INSTRUCTIONS.md');
          
          if (!existsSync(instructionsPath)) {
            console.log(`Skipping ${template} - INSTRUCTIONS.md not found`);
            return;
          }

          const content = readFileSync(instructionsPath, 'utf-8');

          assert.ok(content.includes('Regras Imutáveis'), `${template}: Missing immutable rules section`);
          assert.ok(content.includes('Modelo de Autonomia Três Níveis'), `${template}: Missing autonomy model section`);
          assert.ok(content.includes('/agent_loop'), `${template}: Missing agent_loop command`);
          assert.ok(content.includes('Agentes Especializados'), `${template}: Missing agents table`);
          assert.ok(content.includes('Paralelismo'), `${template}: Missing parallelism section`);
          assert.ok(content.includes('Gate de Validação'), `${template}: Missing validation gates`);
          assert.ok(content.includes('Auditoria'), `${template}: Missing audit section`);
          assert.ok(content.includes('Memória'), `${template}: Missing memory section`);
          assert.ok(content.includes('Proibições Absolutas'), `${template}: Missing prohibitions section`);
        });

        it('should have agents with skills in opencode.json', () => {
          const templateDir = join(TEMPLATES_DIR, template, 'governance');
          
          if (!existsSync(templateDir)) {
            console.log(`Skipping ${template} - directory not found`);
            return;
          }

          const opencodePath = join(templateDir, 'opencode.json');
          
          if (!existsSync(opencodePath)) {
            console.log(`Skipping ${template} - opencode.json not found`);
            return;
          }

          const content = readFileSync(opencodePath, 'utf-8');
          const config = JSON.parse(content);

          assert.ok(config.agents.orchestrator, `${template}: Missing orchestrator agent`);
          assert.ok(config.agents.orchestrator.skills, `${template}: Missing orchestrator skills`);
          assert.ok(Array.isArray(config.agents.orchestrator.skills), `${template}: orchestrator skills should be an array`);
          assert.ok(config.agents.orchestrator.skills.length > 0, `${template}: orchestrator should have at least one skill`);

          assert.ok(config.agents.backend, `${template}: Missing backend agent`);
          assert.ok(config.agents.backend.skills, `${template}: Missing backend skills`);

          assert.ok(config.agents.frontend, `${template}: Missing frontend agent`);
          assert.ok(config.agents.frontend.skills, `${template}: Missing frontend skills`);
        });

        it('should have valid permissions-matrix.json', () => {
          const templateDir = join(TEMPLATES_DIR, template, 'governance');
          
          if (!existsSync(templateDir)) {
            console.log(`Skipping ${template} - directory not found`);
            return;
          }

          const permissionsPath = join(templateDir, 'permissions-matrix.json');
          
          if (!existsSync(permissionsPath)) {
            console.log(`Skipping ${template} - permissions-matrix.json not found`);
            return;
          }

          const content = readFileSync(permissionsPath, 'utf-8');
          const config = JSON.parse(content);

          assert.ok(config.matrix, `${template}: Missing matrix field`);
          assert.ok(Object.keys(config.matrix).length > 0, `${template}: Matrix should have at least one phase`);
        });

        it('should have valid skill-gate.json', () => {
          const templateDir = join(TEMPLATES_DIR, template, 'governance');
          
          if (!existsSync(templateDir)) {
            console.log(`Skipping ${template} - directory not found`);
            return;
          }

          const skillGatePath = join(templateDir, 'skill-gate.json');
          
          if (!existsSync(skillGatePath)) {
            console.log(`Skipping ${template} - skill-gate.json not found`);
            return;
          }

          const content = readFileSync(skillGatePath, 'utf-8');
          const config = JSON.parse(content);

          assert.ok(config.phases, `${template}: Missing phases field`);
          assert.ok(Object.keys(config.phases).length > 0, `${template}: Phases should have at least one entry`);
        });

        it('should have valid state-machine.json', () => {
          const templateDir = join(TEMPLATES_DIR, template, 'governance');
          
          if (!existsSync(templateDir)) {
            console.log(`Skipping ${template} - directory not found`);
            return;
          }

          const stateMachinePath = join(templateDir, 'state-machine.json');
          
          if (!existsSync(stateMachinePath)) {
            console.log(`Skipping ${template} - state-machine.json not found`);
            return;
          }

          const content = readFileSync(stateMachinePath, 'utf-8');
          const config = JSON.parse(content);

          assert.ok(config.states, `${template}: Missing states field`);
          assert.ok(Array.isArray(config.states), `${template}: States should be an array`);
          assert.ok(config.states.length > 0, `${template}: States should have at least one entry`);
          assert.ok(config.transitions, `${template}: Missing transitions field`);
          assert.ok(Array.isArray(config.transitions), `${template}: Transitions should be an array`);
        });

        it('should have valid blueprint README.md', () => {
          const templateDir = join(TEMPLATES_DIR, template, 'blueprint');
          
          if (!existsSync(templateDir)) {
            console.log(`Skipping ${template} - blueprint directory not found`);
            return;
          }

          const readmePath = join(templateDir, 'README.md');
          
          if (!existsSync(readmePath)) {
            console.log(`Skipping ${template} - README.md not found`);
            return;
          }

          const content = readFileSync(readmePath, 'utf-8');

          assert.ok(content.includes('{{PROJECT_NAME}}'), `${template}: Missing PROJECT_NAME variable`);
          assert.ok(content.includes('{{PROJECT_DESCRIPTION}}'), `${template}: Missing PROJECT_DESCRIPTION variable`);
          assert.ok(content.includes('Stack'), `${template}: Missing Stack section`);
          assert.ok(content.includes('Fases'), `${template}: Missing Phases section`);
          assert.ok(content.includes('Regras Imutáveis'), `${template}: Missing Immutable Rules section`);
        });
      });
    });
  });
});
