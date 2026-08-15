#!/usr/bin/env node

/**
 * behaviorOS - Blueprint Generator
 * 
 * Generates blueprint.json for all templates.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const templates = [
  'fintech',
  'saas-b2b',
  'saas-b2c',
  'ecommerce',
  'marketplace',
  'healthcare',
  'education',
  'custom',
];

const blueprintConfigs = {
  'fintech': {
    name: 'fintech-angola',
    description: 'Fintech multi-tenant angolana de processamento de pagamentos',
    template: 'fintech',
    stack: {
      frontend: ['nextjs', 'react', 'tailwind', 'shadcn', 'forms', 'tanstack-query', 'tanstack-table'],
      backend: ['nestjs', 'prisma', 'orpc', 'better-auth', 'zod'],
      database: ['prisma', 'enterprise-database'],
      testing: ['vitest', 'playwright', 'testing-library', 'msw', 'axe-core'],
      devops: ['turbo', 'turborepo', 'dotenvx'],
      security: ['security', 'helmet', 'sentry'],
      compliance: ['compliance', 'fintech-domain', 'financial-ledger'],
    },
    criticalPhases: ['F2', 'F3', 'F5', 'F6'],
  },
  'saas-b2b': {
    name: 'saas-b2b',
    description: 'Business-to-business SaaS application',
    template: 'saas-b2b',
    stack: {
      frontend: ['nextjs', 'react', 'tailwind', 'shadcn'],
      backend: ['nestjs', 'prisma', 'orpc', 'better-auth'],
      database: ['prisma'],
      testing: ['vitest', 'playwright'],
      devops: ['turbo', 'turborepo'],
    },
    criticalPhases: ['F2', 'F3', 'F5', 'F6'],
  },
  'saas-b2c': {
    name: 'saas-b2c',
    description: 'Business-to-consumer SaaS application',
    template: 'saas-b2c',
    stack: {
      frontend: ['nextjs', 'react', 'tailwind', 'shadcn'],
      backend: ['nestjs', 'prisma', 'orpc', 'better-auth'],
      database: ['prisma'],
      testing: ['vitest', 'playwright'],
      devops: ['turbo', 'turborepo'],
    },
    criticalPhases: ['F2', 'F3', 'F5', 'F6'],
  },
  'ecommerce': {
    name: 'ecommerce',
    description: 'Online store platform',
    template: 'ecommerce',
    stack: {
      frontend: ['nextjs', 'react', 'tailwind', 'shadcn'],
      backend: ['nestjs', 'prisma', 'orpc'],
      database: ['prisma'],
      testing: ['vitest', 'playwright'],
      devops: ['turbo', 'turborepo'],
    },
    criticalPhases: ['F2', 'F3', 'F5', 'F6'],
  },
  'marketplace': {
    name: 'marketplace',
    description: 'Multi-sided marketplace',
    template: 'marketplace',
    stack: {
      frontend: ['nextjs', 'react', 'tailwind', 'shadcn'],
      backend: ['nestjs', 'prisma', 'orpc'],
      database: ['prisma'],
      testing: ['vitest', 'playwright'],
      devops: ['turbo', 'turborepo'],
    },
    criticalPhases: ['F2', 'F3', 'F5', 'F6'],
  },
  'healthcare': {
    name: 'healthcare',
    description: 'Medical/health application',
    template: 'healthcare',
    stack: {
      frontend: ['nextjs', 'react', 'tailwind', 'shadcn'],
      backend: ['nestjs', 'prisma', 'orpc'],
      database: ['prisma'],
      testing: ['vitest', 'playwright'],
      devops: ['turbo', 'turborepo'],
    },
    criticalPhases: ['F2', 'F3', 'F5', 'F6'],
  },
  'education': {
    name: 'education',
    description: 'Learning management system',
    template: 'education',
    stack: {
      frontend: ['nextjs', 'react', 'tailwind', 'shadcn'],
      backend: ['nestjs', 'prisma', 'orpc'],
      database: ['prisma'],
      testing: ['vitest', 'playwright'],
      devops: ['turbo', 'turborepo'],
    },
    criticalPhases: ['F2', 'F3', 'F5', 'F6'],
  },
  'custom': {
    name: 'custom',
    description: 'Custom project template',
    template: 'custom',
    stack: {
      frontend: ['nextjs', 'react', 'tailwind'],
      backend: ['nestjs', 'prisma'],
      database: ['prisma'],
      testing: ['vitest'],
      devops: ['turbo'],
    },
    criticalPhases: ['F2', 'F3', 'F5', 'F6'],
  },
};

console.log('Generating blueprint.json for all templates...\n');

for (const template of templates) {
  const templateDir = join(ROOT_DIR, 'templates', template, 'blueprint');
  
  if (!existsSync(templateDir)) {
    mkdirSync(templateDir, { recursive: true });
  }
  
  const blueprintPath = join(templateDir, 'blueprint.json');
  
  if (!existsSync(blueprintPath)) {
    const config = blueprintConfigs[template];
    writeFileSync(blueprintPath, JSON.stringify(config, null, 2));
    console.log(`  Created: templates/${template}/blueprint/blueprint.json`);
  } else {
    console.log(`  Skipped: templates/${template}/blueprint/blueprint.json (exists)`);
  }
}

console.log('\nDone!');
