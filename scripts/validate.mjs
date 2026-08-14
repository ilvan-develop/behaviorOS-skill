#!/usr/bin/env node

/**
 * behaviorOS - Configuration Validator
 * 
 * Usage: node scripts/validate.mjs
 * 
 * Validates that all required governance files are present and correctly configured.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Required files
const REQUIRED_FILES = [
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
const OPTIONAL_FILES = [
  'security-gates.json',
  'production-gate.json',
];

// Validation results
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

// Helper function to validate JSON
function validateJSON(filePath, requiredFields = []) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    // Check required fields
    for (const field of requiredFields) {
      if (!(field in data)) {
        results.failed.push(`  Missing field "${field}" in ${filePath}`);
        return false;
      }
    }
    
    results.passed.push(`  ${filePath} - Valid JSON`);
    return true;
  } catch (err) {
    results.failed.push(`  ${filePath} - Invalid JSON: ${err.message}`);
    return false;
  }
}

// Helper function to validate markdown
function validateMarkdown(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    
    if (content.trim().length === 0) {
      results.warnings.push(`  ${filePath} - Empty file`);
      return false;
    }
    
    if (!content.includes('#')) {
      results.warnings.push(`  ${filePath} - No headings found`);
    }
    
    results.passed.push(`  ${filePath} - Valid Markdown`);
    return true;
  } catch (err) {
    results.failed.push(`  ${filePath} - Error reading file: ${err.message}`);
    return false;
  }
}

// Main validation function
function main() {
  console.log('=== behaviorOS Configuration Validator ===\n');

  const targetDir = process.cwd();
  const governanceDir = join(targetDir, '.opencode', 'governance');

  // Check if governance directory exists
  if (!existsSync(governanceDir)) {
    console.error('Error: .opencode/governance/ directory not found');
    console.error('Please run: node scripts/init.mjs');
    process.exit(1);
  }

  console.log('Validating governance configuration...\n');

  // Validate required files
  console.log('Required files:');
  for (const file of REQUIRED_FILES) {
    const filePath = join(governanceDir, file);
    
    if (!existsSync(filePath)) {
      results.failed.push(`  ${file} - Missing`);
      continue;
    }

    if (file.endsWith('.json')) {
      validateJSON(filePath);
    } else if (file.endsWith('.md')) {
      validateMarkdown(filePath);
    }
  }

  // Validate optional files
  console.log('\nOptional files:');
  for (const file of OPTIONAL_FILES) {
    const filePath = join(governanceDir, file);
    
    if (!existsSync(filePath)) {
      results.warnings.push(`  ${file} - Not present (optional)`);
      continue;
    }

    if (file.endsWith('.json')) {
      validateJSON(filePath);
    }
  }

  // Validate specific configurations
  console.log('\nValidating configurations...');

  // Validate opencode.json
  const opencodePath = join(governanceDir, 'opencode.json');
  if (existsSync(opencodePath)) {
    validateJSON(opencodePath, ['project', 'agents', 'governance']);
  }

  // Validate permissions-matrix.json
  const permissionsPath = join(governanceDir, 'permissions-matrix.json');
  if (existsSync(permissionsPath)) {
    validateJSON(permissionsPath, ['autonomyLevels', 'rules']);
  }

  // Print results
  console.log('\n=== Validation Results ===\n');

  if (results.passed.length > 0) {
    console.log('✅ Passed:');
    results.passed.forEach(r => console.log(r));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    results.warnings.forEach(r => console.log(r));
  }

  if (results.failed.length > 0) {
    console.log('\n❌ Failed:');
    results.failed.forEach(r => console.log(r));
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Passed: ${results.passed.length}`);
  console.log(`Warnings: ${results.warnings.length}`);
  console.log(`Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('\n❌ Validation failed. Please fix the issues above.');
    process.exit(1);
  } else {
    console.log('\n✅ Validation passed!');
    process.exit(0);
  }
}

// Run validation
main();
