#!/usr/bin/env node

/**
 * behaviorOS - Interactive Setup Wizard
 *
 * Usage:
 *   node scripts/init.mjs                    # Interactive wizard
 *   node scripts/init.mjs --blueprint ./path # Install from blueprint
 *
 * Collects answers interactively, then delegates the actual install to
 * core/installer.mjs — the single source of truth also used by scripts/install.mjs.
 */

import { createInterface } from 'readline';
import { installFromTemplate, installFromBlueprint } from '../core/installer.mjs';

const args = process.argv.slice(2);
const blueprintIndex = args.indexOf('--blueprint');
const blueprintPath = blueprintIndex !== -1 ? args[blueprintIndex + 1] : null;

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

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

function select(question, options) {
  return new Promise((resolve) => {
    console.log('\n' + question);
    options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt.name} - ${opt.description}`));
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

function printResult(result) {
  if (!result.success) {
    console.error(`\nError: ${result.error || 'Installation failed'}`);
    process.exit(1);
  }
  for (const file of result.generatedFiles || result.files || []) {
    console.log(`  Created: ${file}`);
  }
  if (result.skills?.success) {
    console.log(`  Skills: installed (${result.skills.source})`);
  }
  console.log('\n✅ behaviorOS installed successfully!');
  console.log('\nNext steps:');
  console.log('1. Review the generated configuration files');
  console.log('2. Customize .opencode/governance/INSTRUCTIONS.md for your project');
  console.log('3. Confirm runtime enforcement is active: ls .opencode/plugins/');
  console.log('4. Start development with: /agent_loop --phase F0');
}

async function runBlueprintFlow(blueprintDir) {
  console.log(`\nInstalling from blueprint: ${blueprintDir}\n`);

  const targetDir = process.cwd();
  const result = installFromBlueprint({ blueprintPath: blueprintDir, targetDir });

  if (!result.success) {
    console.error(`\nError: ${result.error}`);
    rl.close();
    process.exit(1);
  }

  console.log('Blueprint found:');
  if (result.blueprint) {
    console.log(`  Name: ${result.blueprint.name}`);
    console.log(`  Template: ${result.blueprint.template}`);
    console.log(`  Description: ${result.blueprint.description}`);
  }
  console.log('');
  printResult(result);
  rl.close();
}

async function runInteractiveFlow() {
  console.log('=== behaviorOS Setup Wizard ===\n');
  console.log('This wizard will help you set up behaviorOS for your project.\n');

  const projectName = await ask('Project name: ');
  if (!projectName) {
    console.log('Error: Project name is required.');
    rl.close();
    process.exit(1);
  }

  const projectDescription = await ask('Project description: ');
  const template = await select('Select project type:', TEMPLATES);
  console.log(`\nSelected: ${template.name}`);

  const criticalPhasesInput = await ask('Critical phases (comma-separated, e.g., F2,F3): ');
  const criticalPhases = criticalPhasesInput ? criticalPhasesInput.split(',').map((p) => p.trim()) : ['F2', 'F3'];

  console.log('\n--- Configuration Summary ---');
  console.log(`Project: ${projectName}`);
  console.log(`Description: ${projectDescription || 'Not provided'}`);
  console.log(`Template: ${template.name}`);
  console.log(`Critical Phases: ${criticalPhases.join(', ')}`);
  console.log('-----------------------------\n');

  const confirm = await ask('Proceed with installation? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Installation cancelled.');
    rl.close();
    process.exit(0);
  }

  console.log('\nInstalling behaviorOS...');
  const result = installFromTemplate({
    template: template.id,
    projectName,
    projectDescription,
    criticalPhases,
    targetDir: process.cwd(),
  });

  printResult(result);
  rl.close();
}

async function main() {
  if (blueprintPath) {
    await runBlueprintFlow(blueprintPath);
    return;
  }
  await runInteractiveFlow();
}

main().catch((err) => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});
