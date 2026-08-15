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

    // Copy opencode.json to project root
    const opencodeSourcePath = join(templateDir, 'governance', 'opencode.json');
    const opencodeTargetPath = join(targetDir, 'opencode.json');
    if (existsSync(opencodeSourcePath)) {
      let opencodeContent = readFileSync(opencodeSourcePath, 'utf8');
      const projectName = process.env.PROJECT_NAME || 'my-project';
      const projectDescription = process.env.PROJECT_DESCRIPTION || 'My project';
      opencodeContent = opencodeContent.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
      opencodeContent = opencodeContent.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, projectDescription);
      writeFileSync(opencodeTargetPath, opencodeContent);
      console.log('  Created: opencode.json');
    }

    // Copy AGENTS.md to project root
    const agentsSourcePath = join(templateDir, 'governance', 'AGENTS.md');
    const agentsTargetPath = join(targetDir, 'AGENTS.md');
    if (existsSync(agentsSourcePath)) {
      let agentsContent = readFileSync(agentsSourcePath, 'utf8');
      const projectName = process.env.PROJECT_NAME || 'my-project';
      const projectDescription = process.env.PROJECT_DESCRIPTION || 'My project';
      agentsContent = agentsContent.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
      agentsContent = agentsContent.replace(/\{\{DOMAIN\}\}/g, projectDescription || 'web');
      agentsContent = agentsContent.replace(/\{\{STACK\}\}/g, 'TypeScript');
      agentsContent = agentsContent.replace(/\{\{PHASES\}\}/g, '7');
      agentsContent = agentsContent.replace(/\{\{CRITICAL_PHASES\}\}/g, JSON.stringify(['F2', 'F3']));
      agentsContent = agentsContent.replace(/\{\{DOMAIN_RULES\}\}/g, 'Follow project conventions');
      agentsContent = agentsContent.replace(/\{\{DOMAIN_SKILLS\}\}/g, 'none');
      writeFileSync(agentsTargetPath, agentsContent);
      console.log('  Created: AGENTS.md');
    }

    // Copy scripts to project root
    const scriptsDir = join(targetDir, 'scripts');
    if (!existsSync(scriptsDir)) {
      mkdirSync(scriptsDir, { recursive: true });
    }
    
    const sourceScriptsDir = join(ROOT_DIR, 'scripts');
    const scriptFiles = ['enforce.ps1', 'audit-logger.ps1', 'skill-tracker.ps1', 'agent-loop.ps1', 'run-pipeline.ps1', 'state-manager.ps1', 'gates.ps1', 'validate.mjs'];
    
    for (const file of scriptFiles) {
      const src = join(sourceScriptsDir, file);
      const dest = join(scriptsDir, file);
      if (existsSync(src)) {
        let content = readFileSync(src, 'utf8');
        const projectName = process.env.PROJECT_NAME || 'my-project';
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
        writeFileSync(dest, content);
        console.log(`  Created: scripts/${file}`);
      }
    }
    
    // Copy guard scripts
    const guardsDir = join(scriptsDir, 'guards');
    if (!existsSync(guardsDir)) {
      mkdirSync(guardsDir, { recursive: true });
    }
    
    const guardFiles = ['skill-guard.ps1', 'tool-guard.ps1', 'permission-guard.ps1', 'state-guard.ps1'];
    for (const file of guardFiles) {
      const src = join(sourceScriptsDir, 'guards', file);
      const dest = join(guardsDir, file);
      if (existsSync(src)) {
        let content = readFileSync(src, 'utf8');
        const projectName = process.env.PROJECT_NAME || 'my-project';
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
        writeFileSync(dest, content);
        console.log(`  Created: scripts/guards/${file}`);
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
