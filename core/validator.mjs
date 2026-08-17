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

  // opencode.json goes to project root: targetDir/.opencode/governance -> targetDir is two
  // levels up, not one (governanceDir's immediate parent is targetDir/.opencode).
  const projectRoot = join(governanceDir, '..', '..');
  const opencodePath = join(projectRoot, 'opencode.json');
  
  if (!existsSync(opencodePath)) {
    results.errors.push('Missing required file: opencode.json (should be in project root)');
    results.files.missing.push('opencode.json');
    results.valid = false;
  } else {
    results.files.present.push('opencode.json');
    const validationResult = validateJSON(opencodePath);
    if (!validationResult.valid) {
      results.errors.push(`Invalid JSON in opencode.json: ${validationResult.error}`);
      results.valid = false;
    }
  }

  // Required files in governance directory
  const requiredFiles = [
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
    'anti-patterns.json',
    'protected-resources.json',
    'loop-detector.json',
    'dependency-gate.json',
    'truth-gate.json',
    'reviewer-gate.json',
    'mcp-registry.json',
    'handoff-schema.json',
    'definition-of-done.json',
    'ci-gate.json',
    'skill-gate-auto.json',
    'context7-gate.json',
    'version-pinning-gate.json',
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
      case 'opencode':
        return validateOpenCodeConfig(config);
      case 'permissions-matrix':
        return validatePermissionsMatrix(config);
      case 'skill-gate':
        return validateSkillGate(config);
      case 'tool-gate':
        return validateToolGate(config);
      case 'skill-gate-auto':
        return validateSkillGateAuto(config);
      case 'context7-gate':
        return validateContext7Gate(config);
      case 'version-pinning-gate':
        return validateVersionPinningGate(config);
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
  
  // OpenCode's real schema (https://opencode.ai/config.json) uses the singular "agent" key
  // — every template's opencode.json ships that way. Checking "agents" here would falsely
  // fail every correctly-configured project.
  if (!config.agent || typeof config.agent !== 'object') {
    errors.push('Missing or invalid "agent" field');
  }
  
  const result = {
    valid: errors.length === 0,
    error: errors.join('; '),
  };
  
  return result;
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

/**
 * Validate skill-gate-auto.json configuration
 */
function validateSkillGateAuto(config) {
  const errors = [];
  
  if (!config.requiredSkillsForPatterns || typeof config.requiredSkillsForPatterns !== 'object') {
    errors.push('Missing or invalid "requiredSkillsForPatterns" field');
  }
  
  if (!config.action || !['warn', 'block'].includes(config.action)) {
    errors.push('Missing or invalid "action" field (must be "warn" or "block")');
  }
  
  return {
    valid: errors.length === 0,
    error: errors.join('; '),
  };
}

/**
 * Validate context7-gate.json configuration
 */
function validateContext7Gate(config) {
  const errors = [];
  
  if (!config.auditEvent || typeof config.auditEvent !== 'string') {
    errors.push('Missing or invalid "auditEvent" field');
  }
  
  if (!config.windowMinutes || typeof config.windowMinutes !== 'number') {
    errors.push('Missing or invalid "windowMinutes" field');
  }
  
  if (!config.action || !['warn', 'block', 'deny'].includes(config.action)) {
    errors.push('Missing or invalid "action" field (must be "warn", "block", or "deny")');
  }
  
  return {
    valid: errors.length === 0,
    error: errors.join('; '),
  };
}

/**
 * Validate version-pinning-gate.json configuration
 */
function validateVersionPinningGate(config) {
  const errors = [];
  
  if (!config.auditEvent || typeof config.auditEvent !== 'string') {
    errors.push('Missing or invalid "auditEvent" field');
  }
  
  if (!config.windowMinutes || typeof config.windowMinutes !== 'number') {
    errors.push('Missing or invalid "windowMinutes" field');
  }
  
  if (!config.action || !['warn', 'block', 'deny'].includes(config.action)) {
    errors.push('Missing or invalid "action" field (must be "warn", "block", or "deny")');
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
