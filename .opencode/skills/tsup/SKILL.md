---
name: tsup
description: Enterprise tsup 8.x bundler configuration for TypeScript libraries with multiple formats, declaration files, code splitting, and esbuild optimization. Use when building shared packages or configuring library output.
metadata:
  stack: tsup-8
  scope: build
---

# tsup Enterprise Bundler

## Overview

tsup is a fast TypeScript bundler powered by esbuild. It handles TypeScript, JavaScript, and CSS with minimal configuration, supporting ESM, CJS, and IIFE formats.

**When to Use:**
- Building TypeScript libraries/packages
- Creating shared packages in monorepos
- Needing multiple output formats (ESM, CJS)
- Generating declaration files (.d.ts)
- React component library distribution

**When NOT to Use:**
- Complex bundling with many plugins (use webpack)
- Browser-only applications (use Vite)
- Projects requiring non-TypeScript bundling

## Architecture Patterns

### Project Structure
```
packages/
└── shared/
    ├── src/
    │   ├── index.ts
    │   ├── utils/
    │   └── types/
    ├── tsup.config.ts
    ├── package.json
    └── dist/
        ├── index.mjs
        ├── index.cjs
        └── index.d.ts
```

### Configuration File
```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' };
  },
  external: ['react', 'react-dom'],
  banner: {
    js: '"use client";',
  },
  onSuccess: 'tsc --noEmit',
});
```

## Complete Configuration

### tsup.config.ts (Production)

```typescript
import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: options.minify ?? false,
  target: 'es2022',
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' };
  },
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
  ],
  banner: {
    js: '"use client";',
  },
  onSuccess: 'tsc --noEmit',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  esbuildOptions(options) {
    options.charset = 'utf8';
    options.treeShaking = true;
  },
}));
```

### Multiple Entry Points
```typescript
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    utils: 'src/utils/index.ts',
    types: 'src/types/index.ts',
    components: 'src/components/index.ts',
  },
  outDir: 'dist',
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
});
```

### Library Mode Configuration
```typescript
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'iife'],
  globalName: 'FinPayShared',
  outExtension({ format }) {
    if (format === 'iife') return { js: '.global.js' };
    if (format === 'esm') return { js: '.mjs' };
    return { js: '.cjs' };
  },
  platform: 'browser',
  target: 'es2022',
});
```

## Package.json Configuration

### Library Package
```json
{
  "name": "@finpay/shared",
  "version": "0.0.1",
  "type": "module",
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
    },
    "./utils": {
      "import": {
        "types": "./dist/utils.d.ts",
        "default": "./dist/utils.mjs"
      },
      "require": {
        "types": "./dist/utils.d.ts",
        "default": "./dist/utils.cjs"
      }
    }
  },
  "files": ["dist"],
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "build:prod": "tsup --minify",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

## Security Hardening

### Safe Build Configuration
```typescript
export default defineConfig({
  // Don't bundle node_modules by default
  noExternal: [],
  
  // Explicitly externalize dependencies
  external: ['react', 'react-dom', 'node:*'],
  
  // Avoid eval in bundles
  esbuildOptions(options) {
    options.banner = {
      js: '"use strict";',
    };
  },
});
```

### Environment Variable Security
```typescript
export default defineConfig({
  define: {
    // Only expose safe variables
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    // Never expose secrets
    // 'process.env.API_KEY': JSON.stringify(process.env.API_KEY), // ❌
  },
});
```

## Performance Optimization

### Fast Build Settings
```typescript
export default defineConfig({
  // Enable treeshaking
  treeshake: true,
  
  // Use esbuild for faster builds
  esbuildOptions(options) {
    options.treeShaking = true;
    options.minifyWhitespace = true;
    options.minifyIdentifiers = true;
    options.minifySyntax = true;
  },
  
  // Parallel builds
  parallel: true,
});
```

### Caching Strategies
```bash
# tsup has built-in caching
# First run: full build
npx tsup

# Subsequent runs: incremental
npx tsup --watch

# Clean build
npx tsup --clean
```

### Bundle Analysis
```typescript
export default defineConfig({
  // Generate analysis bundle
  onSuccess: 'tsc --noEmit && node scripts/analyze.js',
});

// scripts/analyze.js
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');
const files = fs.readdirSync(distDir);

files.forEach(file => {
  const stats = fs.statSync(path.join(distDir, file));
  console.log(`${file}: ${(stats.size / 1024).toFixed(2)} KB`);
});
```

## Integration Patterns

### With Turbo (Monorepo)
```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

### With Changesets
```json
// package.json
{
  "scripts": {
    "build": "tsup",
    "release": "changeset publish"
  }
}
```

### CI/CD Pipeline
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
    - run: npx tsup
    - run: npx tsc --noEmit
    - run: npm test
```

### With Vitest
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
  build: {
    // tsup handles build
    lib: false,
  },
});
```

## Anti-Patterns

### ❌ DON'T
- Bundle everything: Use `external` for peer dependencies
- Skip type checking: Always run `tsc --noEmit` separately
- Use `.js` extensions in ESM: Use `.mjs` for ESM
- Disable treeshaking: Always enable for production
- Ignore declaration files: Always set `dts: true`

### ✅ DO
- Use `external` for peer dependencies
- Enable `splitting: true` for ESM
- Use `.mjs` for ESM and `.cjs` for CJS
- Enable `sourceMaps: true` for debugging
- Use `banner: { js: '"use client";' }` for React components
- Test builds in CI/CD

## Troubleshooting

### Common Issues

**Declaration Files Not Generated**
```typescript
// Ensure dts is enabled
export default defineConfig({
  dts: true,
  // Or with custom tsconfig
  dts: { entry: 'src/index.ts', tsconfig: 'tsconfig.json' },
});
```

**ESM/CJS Compatibility**
```typescript
// Use proper extensions
export default defineConfig({
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' };
  },
});
```

**Build Performance**
```bash
# Check build time
time npx tsup

# Enable parallel builds
npx tsup --parallel

# Use incremental builds
npx tsup --watch
```

## Observability

### Build Metrics
```bash
# Verbose output
npx tsup --verbose

# Dry run
npx tsup --dry-run

# Show config
npx tsup --show-config
```

### Metrics to Track
- Build time
- Bundle size
- Declaration file generation
- Cache hit rate

## Production Checklist

- [ ] `tsup.config.ts` configured properly
- [ ] Multiple output formats (ESM, CJS)
- [ ] Declaration files enabled
- [ ] External dependencies configured
- [ ] Source maps enabled
- [ ] Treeshaking enabled
- [ ] CI/CD pipeline includes build
- [ ] Type checking runs separately
- [ ] Bundle size monitored
- [ ] Package.json exports configured

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
    - run: npx tsup
    - run: npx tsc --noEmit
    - run: npm test
    - name: Check bundle size
      run: |
        npm run build
        du -sh dist/
```

### GitLab CI
```yaml
build:
  stage: build
  script:
    - npm ci
    - npx tsup
    - npx tsc --noEmit
  artifacts:
    paths:
      - dist/
```

## Team Conventions

- **Configuration Location**: Root `tsup.config.ts`
- **Output Formats**: Always ESM + CJS
- **Declaration Files**: Always generate `.d.ts`
- **External Dependencies**: List peer dependencies explicitly
- **Source Maps**: Enable for debugging
- **Build Scripts**: Use `tsup` in package.json scripts
- **Testing**: Run `tsc --noEmit` separately
- **Documentation**: Keep tsup config updated in README
