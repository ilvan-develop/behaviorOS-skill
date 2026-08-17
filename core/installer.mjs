#!/usr/bin/env node

/**
 * behaviorOS - Installer
 * 
 * Installs behaviorOS governance configuration.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateGovernance, generateMemoryFiles } from './generator.mjs';
import { validateGovernance } from './validator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

/**
 * Install behaviorOS from template
 * @param {Object} options - Installation options
 * @param {string} options.template - Template type
 * @param {string} options.projectName - Project name
 * @param {string} options.projectDescription - Project description
 * @param {string[]} options.criticalPhases - Critical phases
 * @param {string} options.targetDir - Target directory
 * @returns {Object} Installation result
 */
export function installFromTemplate(options) {
  const {
    template,
    projectName,
    projectDescription,
    criticalPhases,
    targetDir,
    domain,
    stack,
    phases,
    domainRules,
    domainSkills,
  } = options;

  // Validate template exists
  const templateDir = join(ROOT_DIR, 'templates', template);
  if (!existsSync(templateDir)) {
    return {
      success: false,
      error: `Template not found: ${template}`,
    };
  }

  // Generate governance configuration
  const governanceResult = generateGovernance({
    projectName,
    projectDescription,
    template,
    criticalPhases,
    targetDir,
    domain,
    stack,
    phases,
    domainRules,
    domainSkills,
  });

  if (!governanceResult.success) {
    return governanceResult;
  }

  // Generate memory files
  const memoryResult = generateMemoryFiles(targetDir, projectName);

  if (!memoryResult.success) {
    return memoryResult;
  }

  // Validate installed configuration
  const validationResult = validateGovernance(governanceResult.governanceDir);

  // Install skills from template
  const skillsResult = installSkills(templateDir, targetDir, {
    projectName,
    projectDescription,
  });

  // Install blueprint README (project-facing description of the template)
  const blueprintFiles = installBlueprint(templateDir, targetDir, {
    projectName,
    projectDescription,
  });

  const generatedFiles = [...governanceResult.generatedFiles, ...blueprintFiles];

  return {
    success: true,
    template,
    projectName,
    governanceDir: governanceResult.governanceDir,
    memoryDir: memoryResult.memoryDir,
    auditDir: governanceResult.auditDir,
    generatedFiles,
    files: generatedFiles, // alias — kept for callers/tests written against either name
    memoryFiles: memoryResult.generatedFiles,
    skills: skillsResult,
    blueprint: blueprintFiles,
    validation: validationResult,
  };
}

/**
 * Copy templateDir/blueprint/README.md into targetDir/.opencode/blueprint/README.md,
 * substituting {{PROJECT_NAME}} / {{PROJECT_DESCRIPTION}} like the other governance files.
 * @returns {string[]} relative paths of files installed
 */
function installBlueprint(templateDir, targetDir, options = {}) {
  const sourcePath = join(templateDir, 'blueprint', 'README.md');
  if (!existsSync(sourcePath)) return [];

  const targetBlueprintDir = join(targetDir, '.opencode', 'blueprint');
  if (!existsSync(targetBlueprintDir)) {
    mkdirSync(targetBlueprintDir, { recursive: true });
  }

  let content = readFileSync(sourcePath, 'utf8');
  content = content.replace(/\{\{PROJECT_NAME\}\}/g, options.projectName || 'my-project');
  content = content.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, options.projectDescription || 'My project');

  writeFileSync(join(targetBlueprintDir, 'README.md'), content);
  return ['.opencode/blueprint/README.md'];
}

/**
 * Copy an entire custom blueprint directory (all its files — README.md plus any other docs
 * like 01-STACK.md, 02-ARCHITECTURE.md, etc.) into targetDir/.opencode/blueprint/, applying
 * the same {{PROJECT_NAME}}/{{PROJECT_DESCRIPTION}} substitution as the rest of the
 * generated files. Returns the relative paths written.
 *
 * This exists because installFromBlueprint's fallback path (no blueprint.json) used to only
 * use the custom blueprint's README to GUESS which built-in template to install, then called
 * installFromTemplate — which installs that TEMPLATE's own generic blueprint/README.md, not
 * anything from the user's actual blueprint directory. A user pointing --blueprint at a real,
 * detailed blueprint (e.g. 14 markdown docs describing architecture, phases, ledger, security)
 * ended up with none of that content in the generated project — just a generic placeholder
 * README, with the real docs silently discarded. Copying the whole source directory here
 * (called after installFromTemplate, so it overwrites the generic placeholder) fixes that.
 */
function copyBlueprintDirectory(blueprintPath, targetDir, options = {}) {
  const targetBlueprintDir = join(targetDir, '.opencode', 'blueprint');
  if (!existsSync(targetBlueprintDir)) {
    mkdirSync(targetBlueprintDir, { recursive: true });
  }

  const written = [];
  for (const entry of readdirSync(blueprintPath, { withFileTypes: true })) {
    if (entry.name === 'blueprint.json') continue; // goes to .opencode/governance/, handled separately
    const srcPath = join(blueprintPath, entry.name);
    if (entry.isDirectory()) continue; // blueprint dirs are flat in practice; skip nested dirs rather than guess structure
    let content = readFileSync(srcPath, 'utf8');
    content = content.replace(/\{\{PROJECT_NAME\}\}/g, options.projectName || 'my-project');
    content = content.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, options.projectDescription || 'My project');
    writeFileSync(join(targetBlueprintDir, entry.name), content);
    written.push(`.opencode/blueprint/${entry.name}`);
  }
  return written;
}

/**
 * Copy directory recursively
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @param {Object} options - Copy options
 * @param {boolean} options.replacePlaceholders - Replace {{PROJECT_NAME}} etc.
 * @param {string} options.projectName - Project name for placeholder replacement
 * @param {string} options.projectDescription - Project description for placeholder replacement
 */
function copyDirRecursive(src, dest, options = {}) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, options);
    } else {
      if (options.replacePlaceholders) {
        let content = readFileSync(srcPath, 'utf8');
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, options.projectName || 'my-project');
        content = content.replace(/\{\{PROJECT_DESCRIPTION\}\}/g, options.projectDescription || 'My project');
        writeFileSync(destPath, content);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }
}

/**
 * Install skills from template
 * @param {string} templateDir - Template directory path
 * @param {string} targetDir - Target project directory
 * @param {Object} options - Installation options
 * @returns {Object} Result with installed skills info
 */
function installSkills(templateDir, targetDir, options = {}) {
  const templateSkillsDir = join(templateDir, 'skills');
  const targetSkillsDir = join(targetDir, '.opencode', 'skills');

  // Always start with base shared skills (foundation)
  const baseSkillsDir = join(ROOT_DIR, 'templates', 'base', 'skills');
  if (existsSync(baseSkillsDir)) {
    if (!existsSync(targetSkillsDir)) {
      mkdirSync(targetSkillsDir, { recursive: true });
    }
    copyDirRecursive(baseSkillsDir, targetSkillsDir, {
      replacePlaceholders: true,
      projectName: options.projectName,
      projectDescription: options.projectDescription,
    });
  }

  // If template has its own skills, merge on top (template overrides base)
  if (existsSync(templateSkillsDir)) {
    if (!existsSync(targetSkillsDir)) {
      mkdirSync(targetSkillsDir, { recursive: true });
    }
    copyDirRecursive(templateSkillsDir, targetSkillsDir, {
      replacePlaceholders: true,
      projectName: options.projectName,
      projectDescription: options.projectDescription,
    });
    return { success: true, source: 'template+base', skillsDir: targetSkillsDir };
  }

  if (existsSync(baseSkillsDir)) {
    return { success: true, source: 'base', skillsDir: targetSkillsDir };
  }

  return { success: false, source: 'none', message: 'No skills found in template or base' };
}

/**
 * Install behaviorOS from blueprint
 * @param {Object} options - Installation options
 * @param {string} options.blueprintPath - Path to blueprint directory
 * @param {string} options.projectName - Project name
 * @param {string} options.projectDescription - Project description
 * @param {string} options.targetDir - Target directory
 * @returns {Object} Installation result
 */
export function installFromBlueprint(options) {
  const {
    blueprintPath,
    projectName,
    projectDescription,
    targetDir,
  } = options;

  // Validate blueprint exists
  if (!existsSync(blueprintPath)) {
    return {
      success: false,
      error: `Blueprint path not found: ${blueprintPath}`,
    };
  }

  // Check for blueprint.json first (structured format)
  const blueprintJsonPath = join(blueprintPath, 'blueprint.json');
  if (existsSync(blueprintJsonPath)) {
    try {
      const blueprintJson = JSON.parse(readFileSync(blueprintJsonPath, 'utf8'));
      
      // Use blueprint.json configuration
      const template = blueprintJson.template || 'custom';
      const name = projectName || blueprintJson.name || 'my-project';
      const description = projectDescription || blueprintJson.description || '';
      const criticalPhases = blueprintJson.criticalPhases || ['F2', 'F3'];

      // Install using template
      const installResult = installFromTemplate({
        template,
        projectName: name,
        projectDescription: description,
        criticalPhases,
        targetDir,
      });

      if (!installResult.success) {
        return installResult;
      }

      // Copy blueprint.json to target
      const targetBlueprintPath = join(targetDir, '.opencode', 'governance', 'blueprint.json');
      writeFileSync(targetBlueprintPath, JSON.stringify(blueprintJson, null, 2));

      // Copy the rest of the blueprint directory (README.md and any other docs alongside
      // blueprint.json) — overwrites the generic template placeholder installFromTemplate
      // just installed, with the user's actual blueprint content.
      const blueprintFiles = copyBlueprintDirectory(blueprintPath, targetDir, { projectName: name, projectDescription: description });

      return {
        ...installResult,
        generatedFiles: [...new Set([...installResult.generatedFiles, ...blueprintFiles])],
        files: [...new Set([...installResult.generatedFiles, ...blueprintFiles])],
        blueprint: blueprintFiles.length ? blueprintFiles : blueprintJson,
        blueprintPath: blueprintJsonPath,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse blueprint.json: ${error.message}`,
      };
    }
  }

  // Fallback: Read README.md to detect template
  const readmePath = join(blueprintPath, 'README.md');
  if (!existsSync(readmePath)) {
    return {
      success: false,
      error: 'Blueprint README.md not found',
    };
  }

  const readmeContent = readFileSync(readmePath, 'utf8');
  
  // Try to detect template from blueprint content
  let template = 'custom';
  
  if (readmeContent.includes('fintech') || readmeContent.includes('Fintech')) {
    template = 'fintech';
  } else if (readmeContent.includes('ecommerce') || readmeContent.includes('E-commerce')) {
    template = 'ecommerce';
  } else if (readmeContent.includes('marketplace') || readmeContent.includes('Marketplace')) {
    template = 'marketplace';
  } else if (readmeContent.includes('healthcare') || readmeContent.includes('Healthcare')) {
    template = 'healthcare';
  } else if (readmeContent.includes('education') || readmeContent.includes('Education')) {
    template = 'education';
  } else if (readmeContent.includes('SaaS B2B')) {
    template = 'saas-b2b';
  } else if (readmeContent.includes('SaaS B2C')) {
    template = 'saas-b2c';
  }

  // Install using detected template (governance/skills backbone), then overlay the user's
  // actual blueprint content on top — see copyBlueprintDirectory's doc comment for why this
  // step exists: without it, none of the custom blueprint's own docs reach the project.
  const name = projectName || extractProjectName(readmeContent);
  const description = projectDescription || extractProjectDescription(readmeContent);

  const installResult = installFromTemplate({
    template,
    projectName: name,
    projectDescription: description,
    criticalPhases: extractCriticalPhases(readmeContent),
    targetDir,
  });

  if (!installResult.success) {
    return installResult;
  }

  const blueprintFiles = copyBlueprintDirectory(blueprintPath, targetDir, { projectName: name, projectDescription: description });

  return {
    ...installResult,
    generatedFiles: [...new Set([...installResult.generatedFiles, ...blueprintFiles])],
    files: [...new Set([...installResult.generatedFiles, ...blueprintFiles])],
    blueprint: blueprintFiles,
    detectedTemplate: template,
  };
}

/**
 * Extract project name from README content
 */
function extractProjectName(content) {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : 'my-project';
}

/**
 * Extract project description from README content
 */
function extractProjectDescription(content) {
  const match = content.match(/^>\s+(.+)/m);
  return match ? match[1].trim() : '';
}

/**
 * Extract critical phases from README content
 */
function extractCriticalPhases(content) {
  const phases = [];
  const phaseRegex = /F(\d+).*?(?:critical|requer|requer)/gi;
  let match;
  
  while ((match = phaseRegex.exec(content)) !== null) {
    phases.push(`F${match[1]}`);
  }
  
  return phases.length > 0 ? phases : ['F2', 'F3'];
}

export default {
  installFromTemplate,
  installFromBlueprint,
};
