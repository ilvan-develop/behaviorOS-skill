#!/usr/bin/env node

/**
 * behaviorOS - Configuration Validator
 * 
 * Validates governance configuration files.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Validate governance configuration
 * @param {string} governanceDir - Path to governance directory
 * @returns {Object} Validation results
 */
export function validateGovernance(governanceDir) {
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    files: {
      present: [],
      missing: [],
    },
  };

  // Required files
  const requiredFiles = [
    'opencode.json',
    'INSTRUCTIONS.md',
    'permissions-matrix.json',
    'skill-gate.json',
    'tool-gate.json',
    'state-machine.json',
    'memory.json',
    'audit.json',
  ];

  // Optional files
  const optionalFiles = [
    'security-gates.json',
    'production-gate.json',
  ];

  // Check required files
  for (const file of requiredFiles) {
    const filePath = join(governanceDir, file);
    
    if (!existsSync(filePath)) {
      results.errors.push(`Missing required file: ${file}`);
      results.files.missing.push(file);
      results.valid = false;
    } else {
      results.files.present.push(file);
      
      // Validate JSON files
      if (file.endsWith('.json')) {
        const validationResult = validateJSON(filePath);
        if (!validationResult.valid) {
          results.errors.push(`Invalid JSON in ${file}: ${validationResult.error}`);
          results.valid = false;
        }
      }
    }
  }

  // Check optional files
  for (const file of optionalFiles) {
    const filePath = join(governanceDir, file);
    
    if (!existsSync(filePath)) {
      results.warnings.push(`Optional file not present: ${file}`);
    } else {
      results.files.present.push(file);
      
      // Validate JSON files
      if (file.endsWith('.json')) {
        const validationResult = validateJSON(filePath);
        if (!validationResult.valid) {
          results.warnings.push(`Invalid JSON in optional file ${file}: ${validationResult.error}`);
        }
      }
    }
  }

  return results;
}

/**
 * Validate JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {Object} Validation result
 */
function validateJSON(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    JSON.parse(content);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Validate specific configuration
 * @param {string} governanceDir - Path to governance directory
 * @param {string} configName - Configuration name
 * @returns {Object} Validation result
 */
export function validateConfig(governanceDir, configName) {
  const filePath = join(governanceDir, `${configName}.json`);
  
  if (!existsSync(filePath)) {
    return { valid: false, error: `Configuration file not found: ${configName}.json` };
  }

  try {
    const content = readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    
    // Add specific validation rules here
    switch (configName) {
      case 'opencode.json':
        return validateOpenCodeConfig(config);
      case 'permissions-matrix.json':
        return validatePermissionsMatrix(config);
      case 'skill-gate.json':
        return validateSkillGate(config);
      case 'tool-gate.json':
        return validateToolGate(config);
      default:
        return { valid: true };
    }
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Validate opencode.json configuration
 */
function validateOpenCodeConfig(config) {
  const errors = [];
  
  if (!config.project) {
    errors.push('Missing "project" field');
  }
  
  if (!config.agents || typeof config.agents !== 'object') {
    errors.push('Missing or invalid "agents" field');
  }
  
  if (!config.governance || typeof config.governance !== 'object') {
    errors.push('Missing or invalid "governance" field');
  } else {
    if (!config.governance.enabled) {
      errors.push('Governance must be enabled');
    }
  }
  
  return {
    valid: errors.length === 0,
    error: errors.join('; '),
  };
}

/**
 * Validate permissions-matrix.json configuration
 */
function validatePermissionsMatrix(config) {
  const errors = [];
  
  if (!config.autonomyLevels || typeof config.autonomyLevels !== 'object') {
    errors.push('Missing or invalid "autonomyLevels" field');
  } else {
    const requiredLevels = ['L1', 'L2', 'L3'];
    for (const level of requiredLevels) {
      if (!config.autonomyLevels[level]) {
        errors.push(`Missing autonomy level: ${level}`);
      }
    }
  }
  
  if (!config.rules || typeof config.rules !== 'object') {
    errors.push('Missing or invalid "rules" field');
  }
  
  return {
    valid: errors.length === 0,
    error: errors.join('; '),
  };
}

/**
 * Validate skill-gate.json configuration
 */
function validateSkillGate(config) {
  const errors = [];
  
  if (!config.rules || !Array.isArray(config.rules)) {
    errors.push('Missing or invalid "rules" field');
  }
  
  if (!config.requiredSkills || typeof config.requiredSkills !== 'object') {
    errors.push('Missing or invalid "requiredSkills" field');
  }
  
  return {
    valid: errors.length === 0,
    error: errors.join('; '),
  };
}

/**
 * Validate tool-gate.json configuration
 */
function validateToolGate(config) {
  const errors = [];
  
  if (!config.rules || !Array.isArray(config.rules)) {
    errors.push('Missing or invalid "rules" field');
  }
  
  return {
    valid: errors.length === 0,
    error: errors.join('; '),
  };
}

export default {
  validateGovernance,
  validateConfig,
};
