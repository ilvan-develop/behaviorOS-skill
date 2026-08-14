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

  return {
    success: true,
    template,
    projectName,
    governanceDir: governanceResult.governanceDir,
    memoryDir: memoryResult.memoryDir,
    auditDir: governanceResult.auditDir,
    generatedFiles: governanceResult.generatedFiles,
    memoryFiles: memoryResult.generatedFiles,
    skills: skillsResult,
    validation: validationResult,
  };
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

  // If template has skills, copy them
  if (existsSync(templateSkillsDir)) {
    if (!existsSync(targetSkillsDir)) {
      mkdirSync(targetSkillsDir, { recursive: true });
    }
    copyDirRecursive(templateSkillsDir, targetSkillsDir, {
      replacePlaceholders: true,
      projectName: options.projectName,
      projectDescription: options.projectDescription,
    });
    return { success: true, source: 'template', skillsDir: targetSkillsDir };
  }

  // Fallback: copy from custom template if available
  const customSkillsDir = join(ROOT_DIR, 'templates', 'custom', 'skills');
  if (existsSync(customSkillsDir)) {
    if (!existsSync(targetSkillsDir)) {
      mkdirSync(targetSkillsDir, { recursive: true });
    }
    copyDirRecursive(customSkillsDir, targetSkillsDir, {
      replacePlaceholders: true,
      projectName: options.projectName,
      projectDescription: options.projectDescription,
    });
    return { success: true, source: 'custom-fallback', skillsDir: targetSkillsDir };
  }

  return { success: false, source: 'none', message: 'No skills found in template or custom fallback' };
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

  // Read blueprint to determine template
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

  // Install using detected template
  return installFromTemplate({
    template,
    projectName: projectName || extractProjectName(readmeContent),
    projectDescription: projectDescription || extractProjectDescription(readmeContent),
    criticalPhases: extractCriticalPhases(readmeContent),
    targetDir,
  });
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
