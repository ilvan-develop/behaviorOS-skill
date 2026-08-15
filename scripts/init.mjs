#!/usr/bin/env node

/**
 * behaviorOS - Interactive Setup Wizard
 * 
 * Usage: 
 *   node scripts/init.mjs                    # Interactive wizard
 *   node scripts/init.mjs --blueprint ./path # Install from blueprint
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

// Parse command line arguments
const args = process.argv.slice(2);
const blueprintIndex = args.indexOf('--blueprint');
const blueprintPath = blueprintIndex !== -1 ? args[blueprintIndex + 1] : null;

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

// Install from blueprint
async function installFromBlueprint(blueprintDir) {
  console.log(`\nInstalling from blueprint: ${blueprintDir}\n`);
  
  const blueprintJsonPath = join(blueprintDir, 'blueprint.json');
  
  if (existsSync(blueprintJsonPath)) {
    // Structured blueprint
    const blueprint = JSON.parse(readFileSync(blueprintJsonPath, 'utf8'));
    
    console.log('Blueprint found:');
    console.log(`  Name: ${blueprint.name}`);
    console.log(`  Template: ${blueprint.template}`);
    console.log(`  Description: ${blueprint.description}`);
    console.log('');
    
    const confirm = await ask('Proceed with installation? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Installation cancelled.');
      process.exit(0);
    }
    
    // Install using blueprint
    const templateDir = join(ROOT_DIR, 'templates', blueprint.template);
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
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, blueprint.name);
        content = content.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, blueprint.description || blueprint.name);
        content = content.replace(/\{\{CRITICAL_PHASES\}\}/g, JSON.stringify(blueprint.criticalPhases || ['F2', 'F3']));
        
        writeFileSync(targetPath, content);
        console.log(`  Created: ${file}`);
      }
    }
    
    // Copy blueprint.json
    writeFileSync(join(governanceDir, 'blueprint.json'), JSON.stringify(blueprint, null, 2));
    console.log('  Created: blueprint.json');
    
    // Copy AGENTS.md to project root
    const agentsSourcePath = join(templateDir, 'governance', 'AGENTS.md');
    const agentsTargetPath = join(targetDir, 'AGENTS.md');
    if (existsSync(agentsSourcePath)) {
      let agentsContent = readFileSync(agentsSourcePath, 'utf8');
      agentsContent = agentsContent.replace(/\{\{PROJECT_NAME\}\}/g, blueprint.name);
      agentsContent = agentsContent.replace(/\{\{DOMAIN\}\}/g, blueprint.domain || 'web');
      agentsContent = agentsContent.replace(/\{\{STACK\}\}/g, blueprint.stack || 'TypeScript');
      agentsContent = agentsContent.replace(/\{\{PHASES\}\}/g, '7');
      agentsContent = agentsContent.replace(/\{\{CRITICAL_PHASES\}\}/g, JSON.stringify(blueprint.criticalPhases || ['F2', 'F3']));
      agentsContent = agentsContent.replace(/\{\{DOMAIN_RULES\}\}/g, blueprint.domainRules || 'Follow project conventions');
      agentsContent = agentsContent.replace(/\{\{DOMAIN_SKILLS\}\}/g, blueprint.domainSkills || 'none');
      writeFileSync(agentsTargetPath, agentsContent);
      console.log('  Created: AGENTS.md');
    }
    
    // Create directories
    const memoryDir = join(targetDir, '.opencode', 'memory');
    const auditDir = join(targetDir, '.opencode', 'audit');
    const skillsDir = join(targetDir, '.opencode', 'skills');
    const scriptsDir = join(targetDir, 'scripts');
    
    if (!existsSync(memoryDir)) mkdirSync(memoryDir, { recursive: true });
    if (!existsSync(auditDir)) mkdirSync(auditDir, { recursive: true });
    if (!existsSync(skillsDir)) mkdirSync(skillsDir, { recursive: true });
    if (!existsSync(scriptsDir)) mkdirSync(scriptsDir, { recursive: true });
    
    // Copy scripts
    const sourceScriptsDir = join(ROOT_DIR, 'scripts');
    const scriptFiles = ['enforce.ps1', 'audit-logger.ps1', 'skill-tracker.ps1', 'agent-loop.ps1'];
    
    for (const file of scriptFiles) {
      const src = join(sourceScriptsDir, file);
      const dest = join(scriptsDir, file);
      if (existsSync(src)) {
        let content = readFileSync(src, 'utf8');
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, blueprint.name);
        writeFileSync(dest, content);
        console.log(`  Created: scripts/${file}`);
      }
    }
    
    // Copy guard scripts
    const guardsDir = join(scriptsDir, 'guards');
    if (!existsSync(guardsDir)) mkdirSync(guardsDir, { recursive: true });
    
    const guardFiles = ['skill-guard.ps1', 'tool-guard.ps1', 'permission-guard.ps1', 'state-guard.ps1'];
    for (const file of guardFiles) {
      const src = join(sourceScriptsDir, 'guards', file);
      const dest = join(guardsDir, file);
      if (existsSync(src)) {
        let content = readFileSync(src, 'utf8');
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, blueprint.name);
        writeFileSync(dest, content);
        console.log(`  Created: scripts/guards/${file}`);
      }
    }
    
    console.log('\nbehaviorOS installed successfully from blueprint!');
    console.log('\nNext steps:');
    console.log('1. Review the generated configuration files');
    console.log('2. Start development with:');
    console.log('   .\\scripts\\agent-loop.ps1 -Phase F0');
    
  } else {
    // Fallback to README.md detection
    console.log('No blueprint.json found, trying README.md detection...');
    // ... existing README.md logic ...
  }
  
  rl.close();
}

// Main setup function
async function main() {
  // If blueprint path provided, install from blueprint
  if (blueprintPath) {
    await installFromBlueprint(blueprintPath);
    return;
  }
  
  // Otherwise, run interactive wizard
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

  // Copy AGENTS.md to project root
  const agentsSourcePath = join(templateDir, 'governance', 'AGENTS.md');
  const agentsTargetPath = join(targetDir, 'AGENTS.md');
  if (existsSync(agentsSourcePath)) {
    let agentsContent = readFileSync(agentsSourcePath, 'utf8');
    agentsContent = agentsContent.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
    agentsContent = agentsContent.replace(/\{\{DOMAIN\}\}/g, projectDescription || 'web');
    agentsContent = agentsContent.replace(/\{\{STACK\}\}/g, 'TypeScript');
    agentsContent = agentsContent.replace(/\{\{PHASES\}\}/g, '7');
    agentsContent = agentsContent.replace(/\{\{CRITICAL_PHASES\}\}/g, JSON.stringify(criticalPhases));
    agentsContent = agentsContent.replace(/\{\{DOMAIN_RULES\}\}/g, 'Follow project conventions');
    agentsContent = agentsContent.replace(/\{\{DOMAIN_SKILLS\}\}/g, 'none');
    writeFileSync(agentsTargetPath, agentsContent);
    console.log('  Created: AGENTS.md');
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

  // Copy skills from template
  const templateSkillsDir = join(templateDir, 'skills');
  const targetSkillsDir = join(targetDir, '.opencode', 'skills');
  if (existsSync(templateSkillsDir)) {
    if (!existsSync(targetSkillsDir)) {
      mkdirSync(targetSkillsDir, { recursive: true });
    }
    // Copy skill directories
    const { readdirSync, statSync, copyFileSync } = await import('fs');
    const copyDirRecursive = (src, dest) => {
      const entries = readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);
        if (entry.isDirectory()) {
          if (!existsSync(destPath)) {
            mkdirSync(destPath, { recursive: true });
          }
          copyDirRecursive(srcPath, destPath);
        } else {
          let content = readFileSync(srcPath, 'utf8');
          content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
          content = content.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, projectDescription || projectName);
          writeFileSync(destPath, content);
        }
      }
    };
    copyDirRecursive(templateSkillsDir, targetSkillsDir);
    console.log('  Skills: Copied from template');
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
