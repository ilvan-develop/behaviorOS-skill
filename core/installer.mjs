#!/usr/bin/env node

/**
 * behaviorOS - Installer
 * 
 * Installs behaviorOS governance configuration.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
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

  return {
    success: true,
    template,
    projectName,
    governanceDir: governanceResult.governanceDir,
    memoryDir: memoryResult.memoryDir,
    auditDir: governanceResult.auditDir,
    generatedFiles: governanceResult.generatedFiles,
    memoryFiles: memoryResult.generatedFiles,
    validation: validationResult,
  };
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
