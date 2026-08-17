#!/usr/bin/env node

/**
 * behaviorOS - Template Installer (CLI)
 *
 * Usage: node scripts/install.mjs --template=<type>
 *        node scripts/install.mjs --blueprint=<path>
 *
 * Thin CLI wrapper around core/installer.mjs — the single source of truth for what gets
 * installed (governance files, runtime enforcement plugins, diagnostic commands, CI
 * workflow). Run from inside the target project directory; installs into process.cwd().
 */

import { join } from 'path';
import { installFromTemplate, installFromBlueprint } from '../core/installer.mjs';

const args = process.argv.slice(2);
const templateArg = args.find((a) => a.startsWith('--template='));
const blueprintArg = args.find((a) => a.startsWith('--blueprint='));

const templateType = templateArg ? templateArg.split('=')[1] : null;
const blueprintPath = blueprintArg ? blueprintArg.split('=')[1] : null;

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

if (!templateType && !blueprintPath) {
  console.error('Error: Either --template or --blueprint is required');
  console.error('Usage:');
  console.error('  node scripts/install.mjs --template=<type>');
  console.error('  node scripts/install.mjs --blueprint=<path>');
  console.error('\nAvailable templates:', AVAILABLE_TEMPLATES.join(', '));
  process.exit(1);
}

function printResult(result) {
  if (!result.success) {
    console.error(`\nError: ${result.error || 'Installation failed'}`);
    if (result.validation && !result.validation.valid) {
      console.error('Validation errors:', result.validation.errors);
    }
    process.exit(1);
  }

  console.log(`\nInstalled in: ${result.governanceDir ? join(result.governanceDir, '..', '..') : process.cwd()}\n`);
  for (const file of result.generatedFiles || result.files || []) {
    console.log(`  Created: ${file}`);
  }
  if (result.skills?.success) {
    console.log(`  Skills: installed (${result.skills.source})`);
  }
  if (result.blueprint?.length) {
    console.log(`  Blueprint: ${result.blueprint.join(', ')}`);
  }

  if (result.validation && !result.validation.valid) {
    console.warn('\n[WARN] Post-install validation found issues:');
    result.validation.errors.forEach((e) => console.warn(`  - ${e}`));
  }

  console.log('\n✅ behaviorOS installed successfully!');
  console.log('\nNext steps:');
  console.log('1. Review the generated configuration files');
  console.log('2. Customize .opencode/governance/INSTRUCTIONS.md for your project');
  console.log('3. Confirm runtime enforcement is active: ls .opencode/plugins/');
  console.log('4. Start development with: /agent_loop --phase F0');
}

function main() {
  const targetDir = process.cwd();
  const projectName = process.env.PROJECT_NAME || 'my-project';
  const projectDescription = process.env.PROJECT_DESCRIPTION || 'My project';

  if (templateType) {
    if (!AVAILABLE_TEMPLATES.includes(templateType)) {
      console.error(`Error: Invalid template type "${templateType}"`);
      console.error('Available templates:', AVAILABLE_TEMPLATES.join(', '));
      process.exit(1);
    }

    console.log(`Installing from template: ${templateType}\n`);
    const result = installFromTemplate({
      template: templateType,
      projectName,
      projectDescription,
      criticalPhases: process.env.CRITICAL_PHASES ? process.env.CRITICAL_PHASES.split(',').map((p) => p.trim()) : ['F2', 'F3'],
      targetDir,
    });
    printResult(result);
  } else {
    console.log(`Installing from blueprint: ${blueprintPath}\n`);
    // Resolved against process.cwd() (Node's default for relative paths) — the caller runs
    // this from inside the target project, so a relative blueprint path is relative to it.
    const result = installFromBlueprint({
      blueprintPath,
      projectName: process.env.PROJECT_NAME || undefined,
      projectDescription: process.env.PROJECT_DESCRIPTION || undefined,
      targetDir,
    });
    printResult(result);
  }
}

main();
