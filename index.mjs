#!/usr/bin/env node

/**
 * behaviorOS - Main Entry Point
 * 
 * Autonomous Development Governance System
 * Exports core modules for programmatic usage.
 */

import { installFromTemplate, listTemplates, getTemplateInfo } from './core/installer.mjs';
import { generateGovernance, generateMemoryFiles } from './core/generator.mjs';
import { validateConfig } from './core/validator.mjs';

export {
  installFromTemplate,
  listTemplates,
  getTemplateInfo,
  generateGovernance,
  generateMemoryFiles,
  validateConfig,
};

export default {
  installFromTemplate,
  listTemplates,
  getTemplateInfo,
  generateGovernance,
  generateMemoryFiles,
  validateConfig,
};
