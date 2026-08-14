#!/usr/bin/env node

/**
 * behaviorOS - Interactive Setup Wizard
 * 
 * Usage: node scripts/init.mjs
 * 
 * This script guides you through setting up behaviorOS for your project.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Available templates
const TEMPLATES = [
  { id: 'saas-b2b', name: 'SaaS B2B', description: 'Business-to-business SaaS application' },
  { id: 'saas-b2c', name: 'SaaS B2C', description: 'Business-to-consumer SaaS application' },
  { id: 'fintech', name: 'Fintech', description: 'Financial technology application' },
  { id: 'ecommerce', name: 'E-commerce', description: 'Online store platform' },
  { id: 'marketplace', name: 'Marketplace', description: 'Multi-sided marketplace' },
  { id: 'healthcare', name: 'Healthcare', description: 'Medical/health application' },
  { id: 'education', name: 'Education', description: 'Learning management system' },
  { id: 'custom', name: 'Custom', description: 'Start from scratch' },
];

// Create readline interface
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper function to ask questions
function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Helper function to select from options
function select(question, options) {
  return new Promise((resolve) => {
    console.log('\n' + question);
    options.forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt.name} - ${opt.description}`);
    });
    
    rl.question('\nSelect option (number): ', (answer) => {
      const index = parseInt(answer) - 1;
      if (index >= 0 && index < options.length) {
        resolve(options[index]);
      } else {
        console.log('Invalid option. Please try again.');
        resolve(select(question, options));
      }
    });
  });
}

// Main setup function
async function main() {
  console.log('=== behaviorOS Setup Wizard ===\n');
  console.log('This wizard will help you set up behaviorOS for your project.\n');

  // Get project name
  const projectName = await ask('Project name: ');
  if (!projectName) {
    console.log('Error: Project name is required.');
    process.exit(1);
  }

  // Get project description
  const projectDescription = await ask('Project description: ');

  // Select template
  const template = await select('Select project type:', TEMPLATES);
  console.log(`\nSelected: ${template.name}`);

  // Get critical phases
  const criticalPhasesInput = await ask('Critical phases (comma-separated, e.g., F2,F3): ');
  const criticalPhases = criticalPhasesInput
    ? criticalPhasesInput.split(',').map(p => p.trim())
    : ['F2', 'F3'];

  console.log('\n--- Configuration Summary ---');
  console.log(`Project: ${projectName}`);
  console.log(`Description: ${projectDescription || 'Not provided'}`);
  console.log(`Template: ${template.name}`);
  console.log(`Critical Phases: ${criticalPhases.join(', ')}`);
  console.log('-----------------------------\n');

  const confirm = await ask('Proceed with installation? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Installation cancelled.');
    process.exit(0);
  }

  // Install template
  console.log('\nInstalling behaviorOS...');
  
  const templateDir = join(ROOT_DIR, 'templates', template.id);
  const targetDir = process.cwd();
  
  // Copy governance files
  const governanceDir = join(targetDir, '.opencode', 'governance');
  if (!existsSync(governanceDir)) {
    mkdirSync(governanceDir, { recursive: true });
  }

  // Read and customize template files
  const files = [
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

  for (const file of files) {
    const sourcePath = join(templateDir, 'governance', file);
    const targetPath = join(governanceDir, file);
    
    if (existsSync(sourcePath)) {
      let content = readFileSync(sourcePath, 'utf8');
      
      // Replace placeholders
      content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
      content = content.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, projectDescription || projectName);
      content = content.replace(/\{\{CRITICAL_PHASES\}\}/g, JSON.stringify(criticalPhases));
      
      writeFileSync(targetPath, content);
      console.log(`  Created: ${file}`);
    }
  }

  // Create memory directory
  const memoryDir = join(targetDir, '.opencode', 'memory');
  if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true });
  }

  // Create audit directory
  const auditDir = join(targetDir, '.opencode', 'audit');
  if (!existsSync(auditDir)) {
    mkdirSync(auditDir, { recursive: true });
  }

  console.log('\n✅ behaviorOS installed successfully!');
  console.log('\nNext steps:');
  console.log('1. Review the generated configuration files');
  console.log('2. Customize INSTRUCTIONS.md for your project');
  console.log('3. Start development with: /agent_loop --phase F0');
  
  rl.close();
}

// Run setup
main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
