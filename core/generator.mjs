#!/usr/bin/env node

/**
 * behaviorOS - Governance Generator
 * 
 * Generates governance configuration from project information.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

/**
 * Generate governance configuration
 * @param {Object} config - Project configuration
 * @param {string} config.projectName - Project name
 * @param {string} config.projectDescription - Project description
 * @param {string} config.template - Template type
 * @param {string[]} config.criticalPhases - Critical phases
 * @param {string} config.targetDir - Target directory
 */
export function generateGovernance(config) {
  const {
    projectName,
    projectDescription,
    template,
    criticalPhases = ['F2', 'F3'],
    targetDir,
  } = config;

  // Validate template
  const templateDir = join(ROOT_DIR, 'templates', template);
  if (!existsSync(templateDir)) {
    throw new Error(`Template not found: ${template}`);
  }

  // Create governance directory
  const governanceDir = join(targetDir, '.opencode', 'governance');
  if (!existsSync(governanceDir)) {
    mkdirSync(governanceDir, { recursive: true });
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

  // Create skills directory
  const skillsDir = join(targetDir, '.opencode', 'skills');
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
  }

  // Create scripts directory and copy enforcement scripts
  const scriptsDir = join(targetDir, 'scripts');
  const guardsDir = join(scriptsDir, 'guards');
  if (!existsSync(scriptsDir)) {
    mkdirSync(scriptsDir, { recursive: true });
  }
  if (!existsSync(guardsDir)) {
    mkdirSync(guardsDir, { recursive: true });
  }

  // Copy enforcement scripts from behaviorOS templates
  const sourceScriptsDir = join(ROOT_DIR, 'scripts');
  const scriptFiles = ['enforce.ps1', 'audit-logger.ps1', 'skill-tracker.ps1'];
  const guardFiles = ['skill-guard.ps1', 'tool-guard.ps1', 'permission-guard.ps1', 'state-guard.ps1'];

  for (const file of scriptFiles) {
    const src = join(sourceScriptsDir, file);
    const dest = join(scriptsDir, file);
    if (existsSync(src)) {
      let content = readFileSync(src, 'utf8');
      content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
      writeFileSync(dest, content);
    }
  }

  for (const file of guardFiles) {
    const src = join(sourceScriptsDir, 'guards', file);
    const dest = join(guardsDir, file);
    if (existsSync(src)) {
      let content = readFileSync(src, 'utf8');
      content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
      writeFileSync(dest, content);
    }
  }

  // Files that go to project root (OpenCode schema)
  const rootFiles = ['opencode.json'];

  // Files that go to .opencode/governance/
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
    'blueprint.json',
  ];

  const generatedFiles = [];

  // Generate root files (opencode.json goes to project root)
  for (const file of rootFiles) {
    const sourcePath = join(templateDir, 'governance', file);
    const targetPath = join(targetDir, file);
    
    if (existsSync(sourcePath)) {
      let content = readFileSync(sourcePath, 'utf8');
      
      // Replace placeholders
      content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
      content = content.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, projectDescription || projectName);
      content = content.replace(/\{\{CRITICAL_PHASES\}\}/g, JSON.stringify(criticalPhases));
      
      writeFileSync(targetPath, content);
      generatedFiles.push(file);
    }
  }

  // Generate governance files (.opencode/governance/)
  for (const file of governanceFiles) {
    const sourcePath = join(templateDir, 'governance', file);
    const targetPath = join(governanceDir, file);
    
    if (existsSync(sourcePath)) {
      let content = readFileSync(sourcePath, 'utf8');
      
      // Replace placeholders
      content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
      content = content.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, projectDescription || projectName);
      content = content.replace(/\{\{CRITICAL_PHASES\}\}/g, JSON.stringify(criticalPhases));
      
      writeFileSync(targetPath, content);
      generatedFiles.push(file);
    }
  }

  return {
    success: true,
    generatedFiles,
    governanceDir,
    memoryDir,
    auditDir,
    skillsDir,
    scriptsDir,
    guardsDir,
  };
}

/**
 * Generate memory files
 * @param {string} targetDir - Target directory
 * @param {string} projectName - Project name
 */
export function generateMemoryFiles(targetDir, projectName) {
  const memoryDir = join(targetDir, '.opencode', 'memory');
  
  if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true });
  }

  const memoryFiles = {
    'decisions.md': `# Decisões Arquiteturais — ${projectName}\n\n> **Projeto:** ${projectName}\n> **Descrição:** Registro de decisões arquiteturais\n\n---\n\n## Decisões Registradas\n\n(nenhuma decisão registrada ainda)\n`,
    'patterns.md': `# Padrões Descobertos — ${projectName}\n\n> **Projeto:** ${projectName}\n> **Descrição:** Padrões descobertos durante desenvolvimento\n\n---\n\n## Padrões\n\n(nenhum padrão descoberto ainda)\n`,
    'learnings.md': `# Lições Aprendidas — ${projectName}\n\n> **Projeto:** ${projectName}\n> **Descrição:** Lições aprendidas durante desenvolvimento\n\n---\n\n## Lições\n\n(nenhuma lição aprendida ainda)\n`,
    'current-phase.md': `# Fase Atual — ${projectName}\n\n> **Projeto:** ${projectName}\n> **Descrição:** Estado da fase atual\n\n---\n\n## Estado\n\n**Fase:** F0 - Foundation\n**Status:** Pendente\n`,
    'scope-history.md': `# Histórico de Escopos — ${projectName}\n\n> **Projeto:** ${projectName}\n> **Descrição:** Histórico de escopos aprovados\n\n---\n\n## Escopos\n\n(nenhum escopo registrado ainda)\n`,
  };

  const generatedFiles = [];

  for (const [filename, content] of Object.entries(memoryFiles)) {
    const filePath = join(memoryDir, filename);
    writeFileSync(filePath, content);
    generatedFiles.push(filename);
  }

  return {
    success: true,
    generatedFiles,
    memoryDir,
  };
}

export default {
  generateGovernance,
  generateMemoryFiles,
};
