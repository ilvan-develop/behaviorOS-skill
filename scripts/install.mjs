#!/usr/bin/env node

/**
 * behaviorOS - Template Installer
 * 
 * Usage: node scripts/install.mjs --template <type>
 *        node scripts/install.mjs --blueprint <path>
 * 
 * Installs behaviorOS governance configuration from template or blueprint.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const templateArg = args.find(a => a.startsWith('--template='));
const blueprintArg = args.find(a => a.startsWith('--blueprint='));

const templateType = templateArg ? templateArg.split('=')[1] : null;
const blueprintPath = blueprintArg ? blueprintArg.split('=')[1] : null;

// Available templates
const AVAILABLE_TEMPLATES = [
  'saas-b2b',
  'saas-b2c',
  'fintech',
  'ecommerce',
  'marketplace',
  'healthcare',
  'education',
  'custom',
];

// Validate arguments
if (!templateType && !blueprintPath) {
  console.error('Error: Either --template or --blueprint is required');
  console.error('Usage:');
  console.error('  node scripts/install.mjs --template <type>');
  console.error('  node scripts/install.mjs --blueprint <path>');
  console.error('\nAvailable templates:', AVAILABLE_TEMPLATES.join(', '));
  process.exit(1);
}

// Helper function to copy directory recursively
function copyDirSync(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      let content = readFileSync(srcPath, 'utf8');
      
      // Replace placeholders if project name is provided
      const projectName = process.env.PROJECT_NAME || 'my-project';
      const projectDescription = process.env.PROJECT_DESCRIPTION || 'My project';
      
      content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
      content = content.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, projectDescription);
      
      writeFileSync(destPath, content);
    }
  }
}

// Helper function to read and customize file
function customizeFile(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) {
    console.warn(`  Warning: ${sourcePath} not found`);
    return false;
  }

  let content = readFileSync(sourcePath, 'utf8');
  
  const projectName = process.env.PROJECT_NAME || 'my-project';
  const projectDescription = process.env.PROJECT_DESCRIPTION || 'My project';
  
  content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
  content = content.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, projectDescription);
  
  writeFileSync(targetPath, content);
  return true;
}

// Main installation function
async function main() {
  console.log('=== behaviorOS Installer ===\n');

  const targetDir = process.cwd();
  const governanceDir = join(targetDir, '.opencode', 'governance');

  // Create directories
  if (!existsSync(governanceDir)) {
    mkdirSync(governanceDir, { recursive: true });
  }

  const memoryDir = join(targetDir, '.opencode', 'memory');
  if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true });
  }

  const auditDir = join(targetDir, '.opencode', 'audit');
  if (!existsSync(auditDir)) {
    mkdirSync(auditDir, { recursive: true });
  }

  if (templateType) {
    // Install from template
    console.log(`Installing from template: ${templateType}\n`);

    if (!AVAILABLE_TEMPLATES.includes(templateType)) {
      console.error(`Error: Invalid template type "${templateType}"`);
      console.error('Available templates:', AVAILABLE_TEMPLATES.join(', '));
      process.exit(1);
    }

    const templateDir = join(ROOT_DIR, 'templates', templateType);
    
    if (!existsSync(templateDir)) {
      console.error(`Error: Template directory not found: ${templateDir}`);
      process.exit(1);
    }

    // Copy governance files
    const governanceFiles = [
      'opencode.json',
      'INSTRUCTIONS.md',
      'permissions-matrix.json',
      'skill-gate.json',
      'tool-gate.json',
      'state-machine.json',
      'memory.json',
      'audit.json',
      'security-gates.json',
      'production-gate.json',
    ];

    for (const file of governanceFiles) {
      const sourcePath = join(templateDir, 'governance', file);
      const targetPath = join(governanceDir, file);
      
      if (customizeFile(sourcePath, targetPath)) {
        console.log(`  Created: ${file}`);
      }
    }

    // Copy blueprint if exists
    const blueprintDir = join(templateDir, 'blueprint');
    if (existsSync(blueprintDir)) {
      console.log('\nBlueprint template available at:', blueprintDir);
    }

    // Copy skills from template
    const templateSkillsDir = join(templateDir, 'skills');
    const targetSkillsDir = join(targetDir, '.opencode', 'skills');

    if (existsSync(templateSkillsDir)) {
      if (!existsSync(targetSkillsDir)) {
        mkdirSync(targetSkillsDir, { recursive: true });
      }
      copyDirSync(templateSkillsDir, targetSkillsDir);
      console.log('\n  Skills installed from template');
    } else {
      // Fallback to custom template skills
      const customSkillsDir = join(ROOT_DIR, 'templates', 'custom', 'skills');
      if (existsSync(customSkillsDir)) {
        if (!existsSync(targetSkillsDir)) {
          mkdirSync(targetSkillsDir, { recursive: true });
        }
        copyDirSync(customSkillsDir, targetSkillsDir);
        console.log('\n  Skills installed from custom fallback');
      }
    }

  } else if (blueprintPath) {
    // Install from blueprint
    console.log(`Installing from blueprint: ${blueprintPath}\n`);

    if (!existsSync(blueprintPath)) {
      console.error(`Error: Blueprint path not found: ${blueprintPath}`);
      process.exit(1);
    }

    // Read blueprint and generate governance
    console.log('  Reading blueprint...');
    // TODO: Implement blueprint parsing and governance generation
    console.log('  Blueprint parsing not yet implemented');
    console.log('  Please use template installation instead');

  }

  console.log('\n✅ behaviorOS installed successfully!');
  console.log('\nConfiguration files created in:');
  console.log(`  ${governanceDir}`);
  console.log('\nNext steps:');
  console.log('1. Review the generated configuration files');
  console.log('2. Customize INSTRUCTIONS.md for your project');
  console.log('3. Start development with: /agent_loop --phase F0');
}

// Run installation
main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
