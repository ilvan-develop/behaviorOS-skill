---
name: swc
description: Enterprise SWC compiler configuration with .swcrc, transforms, decorators, presets, and plugin system. Use when configuring SWC for NestJS, React, or optimizing TypeScript compilation.
metadata:
  stack: swc-1
  scope: build
---

# SWC Enterprise Compiler

## Overview

SWC (Speedy Web Compiler) is a Rust-based TypeScript/JavaScript compiler that's 20-70x faster than Babel. It's the default compiler in Next.js, Vite, and NestJS.

**When to Use:**
- NestJS backend compilation (default compiler)
- React/Next.js fast builds
- Custom transform pipelines
- Plugin-based code modifications
- Monorepo compilation speed optimization

**When NOT to Use:**
- Projects requiring Babel-specific plugins not in SWC
- Teams needing Babel's extensive ecosystem
- Projects with complex Babel configurations already working

## Architecture Patterns

### Project Structure
```
project/
├── .swcrc                  # SWC configuration
├── src/
│   ├── main.ts            # Entry point
│   ├── index.ts           # Main export
│   └── plugins/           # Custom SWC plugins
├── dist/                  # Compiled output
└── package.json
```

### Configuration Hierarchy
1. `.swcrc` in project root
2. `swc.config.js` (JS format)
3. CLI flags override config
4. Package.json `swc` field (limited)

## Complete Configuration

### .swcrc (NestJS Production)

```json
{
  "$schema": "https://swc.rs/schema.json",
  "jsc": {
    "target": "es2022",
    "parser": {
      "syntax": "typescript",
      "decorators": true,
      "decoratorsMetadata": true,
      "dynamicImport": true
    },
    "transform": {
      "legacyDecorator": true,
      "decoratorMetadata": true,
      "useDefineForClassFields": false
    },
    "keepClassNames": true,
    "baseUrl": "./",
    "paths": {
      "@utils/*": ["src/utils/*"],
      "@config/*": ["src/config/*"],
      "@modules/*": ["src/modules/*"],
      "@shared/*": ["packages/shared/src/*"]
    },
    "externalHelpers": false,
    "loose": false
  },
  "module": {
    "type": "commonjs",
    "strict": true,
    "noInterop": false,
    "lazy": false
  },
  "minify": false,
  "sourceMaps": true,
  "exclude": [
    "node_modules",
    "dist",
    "coverage",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

### .swcrc (React/Next.js)

```json
{
  "$schema": "https://swc.rs/schema.json",
  "jsc": {
    "target": "es2022",
    "parser": {
      "syntax": "typescript",
      "tsx": true,
      "decorators": false,
      "dynamicImport": true
    },
    "transform": {
      "react": {
        "runtime": "automatic",
        "development": false,
        "refresh": true,
        "importSource": "react"
      }
    },
    "keepClassNames": true,
    "loose": false
  },
  "module": {
    "type": "es6",
    "strict": true,
    "noInterop": false
  },
  "minify": true,
  "sourceMaps": true,
  "exclude": [
    "node_modules",
    "dist",
    "coverage"
  ]
}
```

### .swcrc (Library Build)

```json
{
  "$schema": "https://swc.rs/schema.json",
  "jsc": {
    "target": "es2022",
    "parser": {
      "syntax": "typescript",
      "tsx": true,
      "decorators": false
    },
    "transform": {
      "react": {
        "runtime": "automatic",
        "importSource": "react"
      }
    },
    "keepClassNames": true,
    "externalHelpers": true
  },
  "module": {
    "type": "es6",
    "strict": true,
    "noInterop": false
  },
  "minify": false,
  "sourceMaps": true
}
```

## Preset-Env Configuration

### Browser Targets
```json
{
  "env": {
    "targets": {
      "chrome": "100",
      "firefox": "100",
      "safari": "15",
      "edge": "100"
    },
    "mode": "usage",
    "coreJs": "3.36",
    "dynamicImport": true,
    "shippedProposals": true
  }
}
```

### Node.js Targets
```json
{
  "env": {
    "targets": {
      "node": "20"
    },
    "mode": "no-usage"
  }
}
```

## Custom Plugin System

### Plugin Interface
```typescript
import type { Plugin } from '@swc/core';

const removeConsolePlugin: Plugin = (m) => ({
  ...m,
  body: m.body.filter((node) => {
    // Remove console.log in production
    if (node.type === 'ExpressionStatement') {
      const expr = node.expression;
      if (expr.type === 'CallExpression') {
        const callee = expr.callee;
        if (callee.type === 'MemberExpression') {
          const obj = callee.object;
          if (obj.type === 'Identifier' && obj.value === 'console') {
            const prop = callee.property;
            if (prop.type === 'Identifier' && prop.value === 'log') {
              return false;
            }
          }
        }
      }
    }
    return true;
  }),
});

export default removeConsolePlugin;
```

### Using Plugins
```json
{
  "jsc": {
    "transform": {
      "plugins": [
        ["./plugins/remove-console.js", {}]
      ]
    }
  }
}
```

### Common Plugin Patterns
```typescript
import type { Plugin } from '@swc/core';

// Add import statements
const addImportPlugin: Plugin = (m) => ({
  ...m,
  body: [
    {
      type: 'ImportDeclaration',
      specifiers: [{
        type: 'ImportSpecifier',
        local: { type: 'Identifier', value: 'console' }
      }],
      source: { type: 'StringLiteral', value: 'console' }
    },
    ...m.body
  ]
});

// Transform specific nodes
const transformPlugin: Plugin = (m) => ({
  ...m,
  body: m.body.map(node => {
    if (node.type === 'VariableDeclaration') {
      // Transform variable declarations
      return node;
    }
    return node;
  })
});
```

## Security Hardening

### Secure Compilation Settings
```json
{
  "jsc": {
    "loose": false,
    "externalHelpers": false
  },
  "module": {
    "strict": true,
    "noInterop": false
  }
}
```

### Prototype Pollution Prevention
```json
{
  "jsc": {
    "parser": {
      "decorators": true,
      "decoratorsMetadata": true
    }
  }
}
```

## Performance Optimization

### Fast Compilation Settings
```json
{
  "jsc": {
    "target": "es2022",
    "keepClassNames": true,
    "externalHelpers": false
  },
  "module": {
    "type": "commonjs"
  },
  "minify": false,
  "sourceMaps": true
}
```

### Parallel Compilation
```bash
# Use multiple threads
SWC_CPU_ARCH=arm64 npx swc src -d dist --jobs 4

# Use specific thread count
npx swc src -d dist --jobs 8
```

### Caching Strategies
```bash
# Enable caching
npx swc src -d dist --cache

# Cache directory
npx swc src -d dist --cache-dir .swc-cache

# Clear cache
rm -rf .swc-cache
```

## Integration Patterns

### package.json Scripts
```json
{
  "scripts": {
    "build": "swc src -d dist",
    "build:watch": "swc src -d dist --watch",
    "build:prod": "swc src -d dist --config-file .swcrc.prod",
    "typecheck": "tsc --noEmit"
  }
}
```

### With tsup
```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  swc: true, // Use SWC for faster compilation
});
```

### With Vite
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import swc from '@vitejs/plugin-swc';

export default defineConfig({
  plugins: [
    swc({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
      },
    }),
  ],
});
```

### CI/CD Integration
```yaml
# .github/workflows/build.yml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
    - run: npm ci
    - run: npx swc src -d dist
    - run: npm test
```

## Anti-Patterns

### ❌ DON'T
- Use `loose: true` in production: Can cause runtime errors
- Disable `externalHelpers` unnecessarily: Increases bundle size
- Mix SWC with Babel: Choose one compiler
- Ignore type errors: Run `tsc --noEmit` separately
- Use outdated `.swcrc` schema: Always use latest schema

### ✅ DO
- Use `keepClassNames: true` for DI frameworks like NestJS
- Enable `sourceMaps: true` for debugging
- Use `externalHelpers: true` for library builds
- Run type-checking separately with `tsc`
- Test compilation output in CI/CD

## Troubleshooting

### Common Issues

**Decorator Metadata Not Working**
```json
{
  "jsc": {
    "parser": {
      "decorators": true,
      "decoratorsMetadata": true
    },
    "transform": {
      "legacyDecorator": true,
      "decoratorMetadata": true
    }
  }
}
```

**Module Resolution Errors**
```json
{
  "jsc": {
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "module": {
    "type": "commonjs"
  }
}
```

**Performance Issues**
```bash
# Check compilation time
time npx swc src -d dist

# Use parallel compilation
npx swc src -d dist --jobs 4

# Enable caching
npx swc src -d dist --cache
```

## Observability

### Compilation Metrics
```bash
# Verbose output
npx swc src -d dist --verbose

# Dry run (no output)
npx swc src -d dist --dry

# Show config
npx swc --show-config
```

### Metrics to Track
- Compilation time
- Bundle size
- Cache hit rate
- Plugin execution time

## Production Checklist

- [ ] `.swcrc` configured with proper schema
- [ ] Target environment specified correctly
- [ ] Decorator metadata enabled for NestJS
- [ ] Source maps enabled for debugging
- [ ] External helpers configured for libraries
- [ ] Caching enabled for faster rebuilds
- [ ] CI/CD pipeline includes SWC compilation
- [ ] Type checking runs separately with `tsc`
- [ ] Plugins tested and working
- [ ] Performance benchmarks established

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
    - run: npx swc src -d dist --cache
    - run: npx tsc --noEmit
    - run: npm test
```

### GitLab CI
```yaml
build:
  stage: build
  script:
    - npm ci
    - npx swc src -d dist --cache
    - npx tsc --noEmit
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - .swc-cache/
```

## Team Conventions

- **Configuration Location**: Root `.swcrc`
- **Target**: Use `es2022` for modern environments
- **Decorators**: Enable `decoratorsMetadata: true` for NestJS
- **Source Maps**: Always enable for debugging
- **Caching**: Enable in development and CI
- **Type Checking**: Run `tsc --noEmit` separately
- **Plugin Development**: Document plugin interfaces clearly
