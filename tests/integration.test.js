#!/usr/bin/env node

/**
 * behaviorOS - Integration Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { installFromTemplate } from '../core/installer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const TEMPLATES_DIR = join(ROOT_DIR, 'templates');

describe('behaviorOS Integration Tests', () => {
  const testDir = join(__dirname, 'test-integration');

  // Setup test directory
  function setupTestDir() {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  }

  // Cleanup test directory
  function cleanupTestDir() {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  }

  describe('Template Installation', () => {
    const templates = ['fintech', 'saas-b2b', 'saas-b2c', 'ecommerce', 'marketplace', 'healthcare', 'education', 'custom'];

    templates.forEach(template => {
      describe(`${template} template installation`, () => {
        it('should install template successfully', () => {
          setupTestDir();
          
          const targetDir = join(testDir, `test-${template}`);
          
          if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
          }

          const result = installFromTemplate({
            template: template,
            projectName: `test-${template}`,
            projectDescription: `Test ${template} project`,
            targetDir: targetDir,
          });

          assert.ok(result.success, `${template} installation should succeed`);
          assert.ok(result.files, `${template} installation should return files`);
          assert.ok(result.files.length > 0, `${template} installation should create files`);
          
          cleanupTestDir();
        });

        it('should create governance directory with all required files', () => {
          setupTestDir();
          
          const targetDir = join(testDir, `test-${template}-files`);
          
          if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
          }

          installFromTemplate({
            template: template,
            projectName: `test-${template}`,
            projectDescription: `Test ${template} project`,
            targetDir: targetDir,
          });

          const governanceDir = join(targetDir, '.opencode', 'governance');

          assert.ok(existsSync(governanceDir), `${template}: Governance directory should exist`);
          // opencode.json is written to the project root, not .opencode/governance/ —
          // see core/generator.mjs's `rootFiles` vs `governanceFiles`.
          assert.ok(existsSync(join(targetDir, 'opencode.json')), `${template}: Missing opencode.json in project root`);

          const requiredFiles = [
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

          requiredFiles.forEach(file => {
            assert.ok(existsSync(join(governanceDir, file)), `${template}: Missing ${file}`);
          });

          cleanupTestDir();
        });

        it('should create blueprint directory with README.md', () => {
          setupTestDir();
          
          const targetDir = join(testDir, `test-${template}-blueprint`);
          
          if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
          }

          installFromTemplate({
            template: template,
            projectName: `test-${template}`,
            projectDescription: `Test ${template} project`,
            targetDir: targetDir,
          });

          const blueprintDir = join(targetDir, '.opencode', 'blueprint');
          
          assert.ok(existsSync(blueprintDir), `${template}: Blueprint directory should exist`);
          assert.ok(existsSync(join(blueprintDir, 'README.md')), `${template}: README.md should exist`);
          
          cleanupTestDir();
        });

        it('should replace template variables correctly', () => {
          setupTestDir();
          
          const targetDir = join(testDir, `test-${template}-vars`);
          
          if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
          }

          const projectName = `my-${template}-app`;
          const projectDescription = `My ${template} application`;

          installFromTemplate({
            template: template,
            projectName: projectName,
            projectDescription: projectDescription,
            targetDir: targetDir,
          });

          const opencodePath = join(targetDir, 'opencode.json');

          assert.ok(existsSync(opencodePath), `${template}: opencode.json should exist in project root`);
          const content = readFileSync(opencodePath, 'utf-8');
          const config = JSON.parse(content);

          assert.strictEqual(config.project, projectName, `${template}: Project name should be replaced`);
          assert.strictEqual(config.description, projectDescription, `${template}: Project description should be replaced`);

          cleanupTestDir();
        });
      });
    });
  });

  describe('Validator Integration', () => {
    it('should validate all templates after installation', () => {
      setupTestDir();
      
      const templates = ['fintech', 'saas-b2b', 'saas-b2c', 'ecommerce', 'marketplace', 'healthcare', 'education', 'custom'];

      templates.forEach(template => {
        const targetDir = join(testDir, `validate-${template}`);
        
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true });
        }

        installFromTemplate({
          template: template,
          projectName: `test-${template}`,
          projectDescription: `Test ${template} project`,
          targetDir: targetDir,
        });

        const governanceDir = join(targetDir, '.opencode', 'governance');

        assert.ok(existsSync(governanceDir), `${template}: Governance directory should exist after installation`);
        assert.ok(existsSync(join(targetDir, 'opencode.json')), `${template}: opencode.json should exist in project root after installation`);
        assert.doesNotThrow(
          () => JSON.parse(readFileSync(join(targetDir, 'opencode.json'), 'utf-8')),
          `${template}: opencode.json should be valid JSON`
        );

        const requiredFiles = [
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

        requiredFiles.forEach(file => {
          const filePath = join(governanceDir, file);
          assert.ok(existsSync(filePath), `${template}: ${file} should exist after installation`);
          
          if (file.endsWith('.json')) {
            const content = readFileSync(filePath, 'utf-8');
            assert.doesNotThrow(() => JSON.parse(content), `${template}: ${file} should be valid JSON`);
          }
        });
      });
      
      cleanupTestDir();
    });
  });

  describe('File Structure', () => {
    // templates/base is shared cross-cutting governance (see core/generator.mjs), not an
    // installable template — it has no blueprint/opencode.json by design and is excluded here.
    const NON_TEMPLATE_DIRS = new Set(['base']);

    it('should have correct directory structure', () => {
      const templates = readdirSync(TEMPLATES_DIR).filter(t => !NON_TEMPLATE_DIRS.has(t));

      templates.forEach(template => {
        const templateDir = join(TEMPLATES_DIR, template);
        
        if (!existsSync(templateDir)) {
          return;
        }

        assert.ok(existsSync(join(templateDir, 'blueprint')), `${template}: Should have blueprint directory`);
        assert.ok(existsSync(join(templateDir, 'governance')), `${template}: Should have governance directory`);
        assert.ok(existsSync(join(templateDir, 'blueprint', 'README.md')), `${template}: Should have blueprint/README.md`);
      });
    });

    it('should have all governance files in each template', () => {
      const templates = readdirSync(TEMPLATES_DIR).filter(t => !NON_TEMPLATE_DIRS.has(t));

      templates.forEach(template => {
        const governanceDir = join(TEMPLATES_DIR, template, 'governance');
        
        if (!existsSync(governanceDir)) {
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

        requiredFiles.forEach(file => {
          assert.ok(existsSync(join(governanceDir, file)), `${template}: Missing ${file}`);
        });
      });
    });
  });
});
