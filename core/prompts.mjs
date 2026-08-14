#!/usr/bin/env node

/**
 * behaviorOS - Interactive Prompts
 * 
 * Provides interactive prompts for behaviorOS setup.
 */

import { createInterface } from 'readline';

/**
 * Create readline interface
 */
function createReadline() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a question
 * @param {string} question - Question to ask
 * @returns {Promise<string>} User answer
 */
export function ask(question) {
  const rl = createReadline();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Ask for confirmation
 * @param {string} question - Question to ask
 * @returns {Promise<boolean>} User confirmation
 */
export async function confirm(question) {
  const answer = await ask(question + ' (y/n): ');
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

/**
 * Select from options
 * @param {string} question - Question to ask
 * @param {Array} options - Array of options
 * @returns {Promise<Object>} Selected option
 */
export async function select(question, options) {
  console.log('\n' + question);
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt.name} - ${opt.description}`);
  });
  
  const answer = await ask('\nSelect option (number): ');
  const index = parseInt(answer) - 1;
  
  if (index >= 0 && index < options.length) {
    return options[index];
  }
  
  console.log('Invalid option. Please try again.');
  return select(question, options);
}

/**
 * Multi-select from options
 * @param {string} question - Question to ask
 * @param {Array} options - Array of options
 * @returns {Promise<Array>} Selected options
 */
export async function multiSelect(question, options) {
  console.log('\n' + question);
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt.name} - ${opt.description}`);
  });
  
  const answer = await ask('\nSelect options (comma-separated numbers): ');
  const indices = answer.split(',').map(s => parseInt(s.trim()) - 1);
  
  return indices
    .filter(i => i >= 0 && i < options.length)
    .map(i => options[i]);
}

/**
 * Get project information
 * @returns {Promise<Object>} Project information
 */
export async function getProjectInfo() {
  console.log('=== behaviorOS Project Setup ===\n');
  
  const projectName = await ask('Project name: ');
  if (!projectName) {
    throw new Error('Project name is required');
  }
  
  const projectDescription = await ask('Project description: ');
  
  return {
    projectName,
    projectDescription,
  };
}

/**
 * Get template selection
 * @returns {Promise<Object>} Selected template
 */
export async function getTemplateSelection() {
  const templates = [
    { id: 'saas-b2b', name: 'SaaS B2B', description: 'Business-to-business SaaS application' },
    { id: 'saas-b2c', name: 'SaaS B2C', description: 'Business-to-consumer SaaS application' },
    { id: 'fintech', name: 'Fintech', description: 'Financial technology application' },
    { id: 'ecommerce', name: 'E-commerce', description: 'Online store platform' },
    { id: 'marketplace', name: 'Marketplace', description: 'Multi-sided marketplace' },
    { id: 'healthcare', name: 'Healthcare', description: 'Medical/health application' },
    { id: 'education', name: 'Education', description: 'Learning management system' },
    { id: 'custom', name: 'Custom', description: 'Start from scratch' },
  ];
  
  return select('Select project type:', templates);
}

/**
 * Get critical phases
 * @returns {Promise<Array>} Critical phases
 */
export async function getCriticalPhases() {
  const answer = await ask('Critical phases (comma-separated, e.g., F2,F3): ');
  
  if (!answer) {
    return ['F2', 'F3'];
  }
  
  return answer.split(',').map(p => p.trim());
}

/**
 * Confirm installation
 * @param {Object} config - Configuration to confirm
 * @returns {Promise<boolean>} User confirmation
 */
export async function confirmInstallation(config) {
  console.log('\n--- Configuration Summary ---');
  console.log(`Project: ${config.projectName}`);
  console.log(`Description: ${config.projectDescription || 'Not provided'}`);
  console.log(`Template: ${config.template}`);
  console.log(`Critical Phases: ${config.criticalPhases.join(', ')}`);
  console.log('-----------------------------\n');
  
  return confirm('Proceed with installation?');
}

export default {
  ask,
  confirm,
  select,
  multiSelect,
  getProjectInfo,
  getTemplateSelection,
  getCriticalPhases,
  confirmInstallation,
};
