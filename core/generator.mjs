#!/usr/bin/env node

/**
 * behaviorOS - Governance Generator
 * 
 * Generates governance configuration from project information.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

/**
 * Copy a directory tree as-is (no placeholder substitution), recording relative paths
 * into `generatedFiles`. Used for .opencode/plugins and .opencode/commands, whose content
 * (JS/markdown) isn't templated per-project the way governance JSON is.
 */
function copyDirRecursiveFlat(src, dest, generatedFiles, labelPrefix) {
  if (!existsSync(src)) return;
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursiveFlat(srcPath, destPath, generatedFiles, `${labelPrefix}/${entry.name}`);
    } else {
      copyFileSync(srcPath, destPath);
      generatedFiles.push(`${labelPrefix}/${entry.name}`);
    }
  }
}

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
    domain = projectDescription || 'web',
    stack = 'TypeScript',
    phases = '7',
    domainRules = 'Follow project conventions',
    domainSkills = 'none',
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
  const scriptFiles = [
    'enforce.ps1', 'audit-logger.ps1', 'skill-tracker.ps1', 'state-manager.ps1',
    'agent-loop.ps1', 'run-pipeline.ps1', 'gates.ps1', 'log-skill-selection.ps1',
    'validate.mjs', 'audit-event.mjs', 'handoff.mjs', 'evidence-check.mjs',
    'reviewer-check.mjs', 'oage-metrics.mjs', 'lint.mjs',
    // Required by the installed CI workflow's quality steps — without it every consumer's
    // pipeline dies on "Cannot find module scripts/ci-run.mjs".
    'ci-run.mjs',
    // Required by the installed CI workflow's gate check — without it the ci-gate-check step
    // fails every consumer's pipeline on "Cannot find module scripts/ci-gate-check.mjs".
    'ci-gate-check.mjs',
    // The Governance Contract ships with every project, so the tool that verifies it must too —
    // otherwise a project carries a declaration of authority it has no way to check.
    'governance-doctor.mjs',
  ];
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

  // Files that go to project root (OpenCode schema). AGENTS.md is optional per template
  // (only fintech ships one today) — silently skipped below when the template has none.
  const rootFiles = ['opencode.json', 'AGENTS.md'];

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
    let sourcePath = join(templateDir, 'governance', file);
    const targetPath = join(targetDir, file);

    // AGENTS.md falls back to the shared base template when the template-specific one is
    // missing (only fintech used to ship its own — every other template silently got no
    // AGENTS.md at all, since this loop used to just skip a missing file rather than fall
    // back). templates/base/governance/AGENTS.md uses the same placeholders as this loop
    // already substitutes below, so no special-casing is needed beyond picking the source.
    if (file === 'AGENTS.md' && !existsSync(sourcePath)) {
      sourcePath = join(ROOT_DIR, 'templates', 'base', 'governance', 'AGENTS.md');
    }

    if (existsSync(sourcePath)) {
      let content = readFileSync(sourcePath, 'utf8');

      // Replace placeholders
      content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
      content = content.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, projectDescription || projectName);

      if (file === 'opencode.json') {
        // Templates ship "criticalPhases": ["F2","F3"] (a valid-JSON default) rather than a
        // bare {{CRITICAL_PHASES}} token, so the template source itself is always valid
        // JSON. Replace the array value directly instead of a token substitution.
        content = content.replace(/("criticalPhases"\s*:\s*)(\{\{CRITICAL_PHASES\}\}|\[[^\]]*\])/, `$1${JSON.stringify(criticalPhases)}`);
      } else {
        // AGENTS.md is prose, not JSON — plain token substitution is fine here.
        content = content.replace(/\{\{CRITICAL_PHASES\}\}/g, JSON.stringify(criticalPhases));
        content = content.replace(/\{\{DOMAIN\}\}/g, domain);
        content = content.replace(/\{\{STACK\}\}/g, stack);
        content = content.replace(/\{\{PHASES\}\}/g, phases);
        content = content.replace(/\{\{DOMAIN_RULES\}\}/g, domainRules);
        content = content.replace(/\{\{DOMAIN_SKILLS\}\}/g, domainSkills);
      }

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
      // Templates ship "criticalPhases": ["F2","F3"] (a valid-JSON default) rather than a
      // bare {{CRITICAL_PHASES}} token, so the template source itself is always valid JSON.
      // Replace the array value directly instead of relying on a token substitution.
      content = content.replace(/("criticalPhases"\s*:\s*)(\{\{CRITICAL_PHASES\}\}|\[[^\]]*\])/, `$1${JSON.stringify(criticalPhases)}`);

      writeFileSync(targetPath, content);
      generatedFiles.push(file);
    }
  }

  // OAGE cross-cutting governance files (shared by every template, not duplicated per
  // template): anti-patterns, protected-resources, loop-detector, dependency-gate,
  // truth-gate, reviewer-gate, mcp-registry, handoff-schema, definition-of-done, ci-gate.
  const sharedGovernanceDir = join(ROOT_DIR, 'templates', 'base', 'governance');
  if (existsSync(sharedGovernanceDir)) {
    for (const file of readdirSync(sharedGovernanceDir)) {
      if (!file.endsWith('.json')) continue;
      const sourcePath = join(sharedGovernanceDir, file);
      const targetPath = join(governanceDir, file);
      if (existsSync(targetPath)) continue; // template-specific file takes precedence
      copyFileSync(sourcePath, targetPath);
      generatedFiles.push(file);
    }

    // Append shared OAGE rules (20-27) to the template's INSTRUCTIONS.md.
    const oageRulesPath = join(sharedGovernanceDir, 'OAGE-RULES.md');
    const instructionsPath = join(governanceDir, 'INSTRUCTIONS.md');
    if (existsSync(oageRulesPath) && existsSync(instructionsPath)) {
      const rules = readFileSync(oageRulesPath, 'utf8');
      const existing = readFileSync(instructionsPath, 'utf8');
      if (!existing.includes('Regras OAGE Adicionais')) {
        writeFileSync(instructionsPath, existing + '\n' + rules);
      }
    }
  }

  // Runtime enforcement plugins (.opencode/plugins/) — without these, the JSON gates above
  // are advisory only (see Rule 16-19); the plugins are what makes them run on every tool
  // call automatically instead of depending on the agent choosing to invoke enforce.ps1.
  const sourcePluginsDir = join(ROOT_DIR, '.opencode', 'plugins');
  const targetPluginsDir = join(targetDir, '.opencode', 'plugins');
  copyDirRecursiveFlat(sourcePluginsDir, targetPluginsDir, generatedFiles, '.opencode/plugins');

  // OAGE diagnostic commands (/oage-doctor, /oage-audit, /oage-review, /oage-research, /oage-release)
  const sourceCommandsDir = join(ROOT_DIR, '.opencode', 'commands');
  const targetCommandsDir = join(targetDir, '.opencode', 'commands');
  copyDirRecursiveFlat(sourceCommandsDir, targetCommandsDir, generatedFiles, '.opencode/commands');

  // Installable CI workflow enforcing gates as the final authority (OAGE §34-36, §60)
  const ciSource = join(ROOT_DIR, 'templates', 'base', 'ci', 'oage-ci.yml');
  if (existsSync(ciSource)) {
    const workflowsDir = join(targetDir, '.github', 'workflows');
    if (!existsSync(workflowsDir)) {
      mkdirSync(workflowsDir, { recursive: true });
    }
    copyFileSync(ciSource, join(workflowsDir, 'oage-ci.yml'));
    generatedFiles.push('.github/workflows/oage-ci.yml');
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
