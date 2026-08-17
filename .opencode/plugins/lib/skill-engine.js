import fs from 'fs';
import path from 'path';

const KNOWN_TECHNOLOGIES = {
  prisma: { files: ['*.prisma', 'schema.prisma'], skills: ['prisma'] },
  nestjs: { files: ['*.controller.ts', '*.service.ts', '*.module.ts', '*.guard.ts', '*.pipe.ts', '*.middleware.ts', '*.decorator.ts'], skills: ['nestjs'] },
  react: { files: ['*.component.tsx', '*.page.tsx', '*.layout.tsx'], skills: ['react'] },
  nextjs: { files: ['*.page.tsx', '*.layout.tsx', 'next.config.*'], skills: ['nextjs'] },
  vitest: { files: ['*.test.ts', '*.spec.ts', '*.test.tsx', '*.spec.tsx', 'vitest.config.*'], skills: ['vitest'] },
  tailwind: { files: ['tailwind.config.*', '*.css'], skills: ['tailwind'] },
  zod: { files: ['*.contract.ts', '*.schema.ts'], skills: ['zod'] },
  orpc: { files: ['*.contract.ts'], skills: ['orpc'] },
  'better-auth': { files: ['*.auth.ts', 'auth/**'], skills: ['better-auth'] },
  'better-auth-ui': { files: ['auth/**/*.tsx'], skills: ['better-auth-ui'] },
  tanstack: { files: ['*.query.ts', '*.mutation.ts'], skills: ['tanstack-query'] },
  'react-hook-form': { files: ['*form*.tsx', '*Form*.tsx'], skills: ['forms'] },
  playwright: { files: ['*.e2e.ts', '*.e2e.tsx', 'playwright.config.*'], skills: ['playwright'] },
  sentry: { files: ['sentry.*', 'sentry.client.*', 'sentry.server.*'], skills: ['sentry'] },
  swagger: { files: ['swagger.*', '*.swagger.*'], skills: ['swagger'] },
  docker: { files: ['Dockerfile', 'docker-compose.*', 'docker*'], skills: ['docker'] },
  kubernetes: { files: ['*.yaml', '*.yml', 'k8s/**'], skills: ['kubernetes'] },
  githubActions: { files: ['.github/**', '*.github.*'], skills: ['github-actions'] },
  husky: { files: ['.husky/**', 'husky.config.*'], skills: ['husky'] },
  prisma: { files: ['schema.prisma', '*.prisma'], skills: ['prisma'] },
  minio: { files: ['*minio*', '*upload*'], skills: ['minio'] },
  nodemailer: { files: ['*email*', '*mail*'], skills: ['nodemailer'] },
  ioredis: { files: ['*redis*', '*cache*'], skills: ['ioredis'] },
  bullmq: { files: ['*queue*', '*job*'], skills: ['bullmq'] },
  helmet: { files: ['*helmet*', '*security*'], skills: ['helmet'] },
  prometheus: { files: ['*metrics*', '*prometheus*'], skills: ['prom-client'] },
  'storybook': { files: ['*.stories.*', '.storybook/**'], skills: ['storybook'] },
  'lint-staged': { files: ['.lintstaged*', 'lint-staged.config.*'], skills: ['lint-staged'] },
  'commitlint': { files: ['commitlint.config.*', '.commitlintrc*'], skills: ['commitlint'] },
  'changesets': { files: ['.changeset/**'], skills: ['changesets'] },
  'turbo': { files: ['turbo.json', 'turborepo*'], skills: ['turbo'] },
  'tsup': { files: ['tsup.config.*'], skills: ['tsup'] },
  'postcss': { files: ['postcss.config.*'], skills: ['postcss'] },
  'swc': { files: ['.swcrc'], skills: ['swc'] },
  'vite': { files: ['vite.config.*'], skills: ['vite'] },
  'socketio': { files: ['*socket*', '*websocket*'], skills: ['socketio'] },
  'dotenvx': { files: ['.env*', 'dotenv*'], skills: ['dotenvx'] },
  'ui-radix': { files: ['*dialog*', '*dropdown*', '*tooltip*', '*popover*', '*select*'], skills: ['ui-radix'] },
  'axe-core': { files: ['*a11y*', '*accessibility*'], skills: ['axe-core'] },
  'testing-library': { files: ['*.test.*', '*.spec.*'], skills: ['testing-library'] },
  'msw': { files: ['*mock*', '*handler*'], skills: ['msw'] },
  'playwright': { files: ['*.e2e.*', 'playwright.config.*'], skills: ['playwright'] }
};

function detectTechnologies(filePath, fileContent) {
  const detected = new Set();
  const normalizedPath = (filePath || '').replace(/\\/g, '/').toLowerCase();

  for (const [tech, config] of Object.entries(KNOWN_TECHNOLOGIES)) {
    if (detected.has(tech)) continue;
    for (const pattern of config.files) {
      const normalizedPattern = pattern.toLowerCase();
      if (normalizedPattern.includes('*')) {
        const regex = new RegExp(
          '^' + normalizedPattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$'
        );
        if (regex.test(normalizedPath)) {
          detected.add(tech);
          break;
        }
      } else if (normalizedPath.includes(normalizedPattern)) {
        detected.add(tech);
        break;
      }
    }
  }

  if (fileContent) {
    const imports = fileContent.match(/from\s+['"]([^'"]+)['"]/g) || [];
    for (const imp of imports) {
      const match = imp.match(/from\s+['"]([^'"]+)['"]/);
      if (match) {
        const pkg = match[1].split('/')[0];
        for (const [tech, config] of Object.entries(KNOWN_TECHNOLOGIES)) {
          if (pkg === tech || pkg.includes(tech)) {
            detected.add(tech);
          }
        }
      }
    }
  }

  return [...detected];
}

function resolveSkills(technologies) {
  const skills = new Set();
  for (const tech of technologies) {
    const config = KNOWN_TECHNOLOGIES[tech];
    if (config) {
      config.skills.forEach(s => skills.add(s));
    }
  }
  return [...skills];
}

function resolveIntents(technologies) {
  const intents = new Set();
  for (const tech of technologies) {
    const config = KNOWN_TECHNOLOGIES[tech];
    if (config && config.intents) {
      config.intents.forEach(i => intents.add(i));
    }
  }
  return [...intents];
}

export { detectTechnologies, resolveSkills, resolveIntents, KNOWN_TECHNOLOGIES };
