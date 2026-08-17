---
name: turbo
description: Enterprise Turborepo 2.x monorepo build system with pipeline configuration, caching, task orchestration, and workspace management. Use when configuring, debugging, or optimizing Turborepo builds and monorepo workflows.
metadata:
  stack: turbo-2
  scope: monorepo
---

# Turborepo Enterprise Monorepo

## Overview

Turborepo is a high-performance build system for JavaScript/TypeScript monorepos. It provides incremental builds, parallel execution, and intelligent caching.

**When to Use:**
- Monorepos with multiple packages/apps
- Needing incremental builds and caching
- Parallel task execution across packages
- Complex dependency graphs between packages
- CI/CD optimization for monorepos

**When NOT to Use:**
- Single-package projects
- Simple project structures
- Teams unfamiliar with monorepo patterns

## Architecture Patterns

### Project Structure
```
finpay/
├── turbo.json              # Turborepo configuration
├── package.json            # Root package.json
├── apps/
│   ├── web/                # Next.js frontend
│   └── api/                # NestJS backend
├── packages/
│   ├── shared/             # Shared utilities
│   ├── ui/                 # UI components
│   └── config/             # Shared configurations
└── .github/
    └── workflows/
        └── ci.yml          # CI pipeline
```

### Dependency Graph
```
web → shared
web → ui
api → shared
ui → shared
```

## Complete Configuration

### turbo.json (Production)

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "globalDependencies": [".env.*", ".env"],
  "globalEnv": ["NODE_ENV", "CI"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "inputs": ["src/**", "package.json", "tsconfig.json"],
      "outputLogs": "new-only"
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": [],
      "inputs": ["src/**", "*.json", "*.js", "*.ts"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**", "test/**", "**/*.test.*", "**/*.spec.*"]
    },
    "test:unit": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "test:integration": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "clean": {
      "cache": false
    },
    "db:generate": {
      "cache": false,
      "dependsOn": ["^build"]
    },
    "db:migrate": {
      "cache": false,
      "dependsOn": ["db:generate"]
    },
    "db:seed": {
      "cache": false,
      "dependsOn": ["db:generate"]
    },
    "format": {
      "cache": false
    },
    "prepare": {
      "cache": false
    },
    "analyze": {
      "dependsOn": ["build"],
      "outputs": ["analysis/**"]
    }
  }
}
```

### Root package.json

```json
{
  "name": "finpay",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "build:filter": "turbo run build --filter=",
    "dev": "turbo run dev",
    "dev:web": "turbo run dev --filter=@finpay/web",
    "dev:api": "turbo run dev --filter=@finpay/api",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:unit": "turbo run test:unit",
    "test:e2e": "turbo run test:e2e",
    "test:integration": "turbo run test:integration",
    "clean": "turbo run clean",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "validate": "turbo run lint typecheck test",
    "db:generate": "turbo run db:generate",
    "db:migrate": "turbo run db:migrate",
    "db:seed": "turbo run db:seed",
    "analyze": "turbo run analyze"
  },
  "devDependencies": {
    "turbo": "^2.9.18",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.0.0"
}
```

## Workspace Package Examples

### apps/web/package.json
```json
{
  "name": "@finpay/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "clean": "rm -rf .next dist"
  },
  "dependencies": {
    "@finpay/shared": "workspace:*",
    "@finpay/ui": "workspace:*",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@finpay/config": "workspace:*",
    "typescript": "^5.0.0"
  }
}
```

### packages/shared/package.json
```json
{
  "name": "@finpay/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

## Remote Cache Configuration

### turbo.json
```json
{
  "remoteCache": {
    "enabled": true,
    "signature": false
  }
}
```

### Environment Variables
```bash
# Enable remote cache
TURBO_REMOTE_CACHE=true

# Authentication token
TURBO_TOKEN=your-token-here

# Team slug
TURBO_TEAM=your-team
```

### Vercel Remote Cache
```yaml
# .github/workflows/ci.yml
- name: Turbo Cache
  uses: vercel/turborepo-action@v1
  with:
    token: ${{ secrets.TURBO_TOKEN }}
    team: ${{ secrets.TURBO_TEAM }}
```

## Filtering Patterns

### Filter by Package
```bash
# Build specific package
turbo run build --filter=@finpay/web

# Build package and dependencies
turbo run build --filter=@finpay/web...

# Build package and dependents
turbo run build --filter=@finpay/web...

# Exclude packages
turbo run build --filter=!@finpay/test-utils
```

### Filter by Change
```bash
# Build changed packages
turbo run build --filter=[origin/main]

# Build changed packages since last commit
turbo run build --filter=[HEAD~1]

# Build changed packages since specific commit
turbo run build --filter=[abc123]
```

### Complex Filters
```bash
# Build web and its dependencies
turbo run build --filter=@finpay/web...

# Build all packages except test-utils
turbo run build --filter=!@finpay/test-utils

# Build packages that depend on shared
turbo run build --filter=@finpay/shared...
```

## Task Dependencies

### Understanding Dependencies
```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

### Dependency Types
- `^build`: Build dependencies first (upstream packages)
- `build`: Build this package first (downstream)
- No dependency: Run independently

### Example Dependency Chain
```
shared:build → ui:build → web:build
shared:build → api:build
```

## Security Hardening

### Secure Configuration
```json
{
  "globalDependencies": [".env.*"],
  "globalEnv": ["NODE_ENV", "CI"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

### Environment Variable Security
```bash
# Never commit secrets
# Use .env.example for documentation
# Use CI/CD secrets for sensitive values
```

## Performance Optimization

### Fast Build Settings
```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "inputs": ["src/**", "package.json", "tsconfig.json"],
      "outputLogs": "new-only"
    }
  }
}
```

### Caching Strategies
```bash
# Local cache only
turbo run build --cache-dir=.turbo/cache

# Remote cache
TURBO_REMOTE_CACHE=true turbo run build

# No cache (fresh build)
turbo run build --force

# Prune cache
turbo prune --docker
```

### Parallel Execution
```bash
# Run tasks in parallel
turbo run build --parallel

# Limit concurrency
turbo run build --concurrency=4

# Continue on error
turbo run build --continue
```

## Integration Patterns

### With Changesets
```json
{
  "scripts": {
    "release": "changeset publish",
    "version": "changeset version"
  }
}
```

### With Docker
```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY turbo.json ./
RUN npm ci
COPY . .
RUN turbo run build --filter=@finpay/web

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./
RUN npm ci --production
CMD ["npm", "start"]
```

### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: turbo run build
      - run: turbo run lint
      - run: turbo run typecheck
      - run: turbo run test
```

## Anti-Patterns

### ❌ DON'T
- Use `cache: false` for build tasks: Always enable caching
- Skip `dependsOn`: Always specify dependencies
- Use `outputs: []` for build tasks: Always specify outputs
- Ignore `inputs`: Always specify for cache invalidation
- Run tasks without dependencies: Use `dependsOn`

### ✅ DO
- Use `^build` for upstream dependencies
- Enable caching for all tasks
- Use `inputs` for fine-grained cache invalidation
- Use `outputLogs: "new-only"` for cleaner output
- Use filtering for development workflows
- Test dependency changes thoroughly

## Troubleshooting

### Common Issues

**Cache Not Working**
```bash
# Check cache directory
turbo run build --cache-dir=.turbo/cache

# Clear cache
rm -rf .turbo

# Force rebuild
turbo run build --force
```

**Dependency Issues**
```bash
# Show task graph
turbo run build --dry

# Verbose output
turbo run build --verbose

# Continue on error
turbo run build --continue
```

**Performance Issues**
```bash
# Check parallel execution
turbo run build --concurrency=4

# Use remote cache
TURBO_REMOTE_CACHE=true turbo run build

# Profile builds
turbo run build --profile
```

## Observability

### Build Metrics
```bash
# Show task graph
turbo run build --dry

# Verbose output
turbo run build --verbose

# Profile builds
turbo run build --profile
```

### Metrics to Track
- Build time per package
- Cache hit rate
- Task execution order
- Remote cache usage

## Production Checklist

- [ ] `turbo.json` configured properly
- [ ] Dependencies specified correctly
- [ ] Outputs configured for caching
- [ ] Remote cache enabled
- [ ] Filtering patterns tested
- [ ] CI/CD pipeline includes Turborepo
- [ ] Team trained on Turborepo usage
- [ ] Cache strategies optimized
- [ ] Dependency graph documented

## CI/CD Integration

### GitHub Actions
```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
    - run: npm ci
    - run: turbo run build
    - run: turbo run lint
    - run: turbo run typecheck
    - run: turbo run test
```

### GitLab CI
```yaml
build:
  stage: build
  script:
    - npm ci
    - turbo run build
    - turbo run lint
    - turbo run typecheck
    - turbo run test
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - .turbo/
      - node_modules/
```

## Team Conventions

- **Configuration Location**: Root `turbo.json`
- **Task Dependencies**: Always specify `dependsOn`
- **Caching**: Enable for all tasks
- **Filtering**: Use filtering for development
- **Documentation**: Keep dependency graph updated
- **Testing**: Test dependency changes thoroughly
- **CI/CD**: Use Turborepo in CI/CD pipelines
- **Remote Cache**: Enable for team collaboration
