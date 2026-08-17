---
name: lint-staged
description: Enterprise lint-staged 17.x pre-commit linting with parallel execution, custom commands, and Biome integration. Use when configuring pre-commit checks, linting staged files, or optimizing Git hooks.
metadata:
  stack: lint-staged-17
  scope: code-quality
---

# lint-staged Enterprise Pre-commit

## Overview

lint-staged is a tool for running linters on staged Git files. It's fast because it only checks files that are about to be committed.

**When to Use:**
- Pre-commit code quality checks
- Auto-fixing linting issues before commit
- Running formatters on staged files
- Type checking on changed files
- Team collaboration on code standards

**When NOT to Use:**
- Projects without Git
- Solo projects without code quality needs
- Non-JavaScript projects

## Architecture Patterns

### Project Structure
```
project/
├── package.json            # lint-staged config
├── .husky/
│   └── pre-commit          # Git hook
├── biome.json              # Biome configuration
└── .github/
    └── workflows/
        └── ci.yml
```

## Complete Configuration

### package.json Configuration

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "biome check --write --no-errors-on-unmatched"
    ],
    "*.{json,css,md}": [
      "biome format --write"
    ],
    "*.prisma": [
      "prisma format"
    ]
  }
}
```

### Advanced Configuration

```javascript
// lint-staged.config.js
export default {
  '*.{ts,tsx}': (files) => {
    const tsFiles = files.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
    if (tsFiles.length === 0) return [];
    return [`biome check --write ${tsFiles.join(' ')}`];
  },
  '*.{js,jsx}': ['biome check --write'],
  '*.{json,css,md}': ['biome format --write'],
  '*.prisma': ['prisma format'],
  '*.{yml,yaml}': ['prettier --write'],
};
```

### Complex Configuration

```javascript
// lint-staged.config.js
import path from 'path';

const configuration = {
  '*.{ts,tsx}': (files) => {
    // Only lint TypeScript files
    const tsFiles = files.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
    if (tsFiles.length === 0) return [];

    // Run biome check
    return [`biome check --write ${tsFiles.join(' ')}`];
  },

  '*.{js,jsx}': (files) => {
    // Only lint JavaScript files
    const jsFiles = files.filter((f) => f.endsWith('.js') || f.endsWith('.jsx'));
    if (jsFiles.length === 0) return [];

    return [`biome check --write ${jsFiles.join(' ')}`];
  },

  '*.{json,css,md}': (files) => {
    // Format JSON, CSS, and Markdown files
    return [`biome format --write ${files.join(' ')}`];
  },

  '*.prisma': (files) => {
    // Format Prisma schema files
    return [`prisma format ${files.join(' ')}`];
  },

  '*.{yml,yaml}': (files) => {
    // Format YAML files
    return [`prettier --write ${files.join(' ')}`];
  },
};

export default configuration;
```

## Security Hardening

### Safe Linting

```javascript
// lint-staged.config.js
export default {
  '*.{ts,tsx,js,jsx}': (files) => {
    // Validate no secrets in staged files
    const fs = require('fs');
    const filesWithSecrets = files.filter((file) => {
      const content = fs.readFileSync(file, 'utf8');
      return /password|secret|api[_-]?key|token/i.test(content);
    });

    if (filesWithSecrets.length > 0) {
      console.error('❌ Potential secrets found in:');
      filesWithSecrets.forEach((file) => console.error(`  - ${file}`));
      process.exit(1);
    }

    return [`biome check --write ${files.join(' ')}`];
  },
};
```

### Prevent Dangerous Patterns

```javascript
// lint-staged.config.js
export default {
  '*.{ts,tsx,js,jsx}': (files) => {
    // Check for dangerous patterns
    const fs = require('fs');
    const dangerousPatterns = [
      /eval\(/,
      /new Function\(/,
      /innerHTML\s*=/,
      /dangerouslySetInnerHTML/,
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of dangerousPatterns) {
        if (pattern.test(content)) {
          console.error(`❌ Dangerous pattern found in ${file}: ${pattern}`);
          process.exit(1);
        }
      }
    }

    return [`biome check --write ${files.join(' ')}`];
  },
};
```

## Performance Optimization

### Fast Linting

```javascript
// lint-staged.config.js
export default {
  // Only lint changed files
  '*.{ts,tsx,js,jsx}': (files) => {
    if (files.length === 0) return [];
    return [`biome check --write ${files.join(' ')}`];
  },

  // Skip formatting for unchanged files
  '*.{json,css,md}': (files) => {
    if (files.length === 0) return [];
    return [`biome format --write ${files.join(' ')}`];
  },
};
```

### Parallel Execution

```javascript
// lint-staged.config.js
export default {
  // Run all checks in parallel
  '*.{ts,tsx,js,jsx}': (files) => {
    return [
      `biome check --write ${files.join(' ')}`,
      `biome format --write ${files.join(' ')}`,
    ];
  },
};
```

### Caching Strategies

```javascript
// lint-staged.config.js
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { hashSync } from 'crypto';

const cacheDir = '.lint-staged-cache';

export default {
  '*.{ts,tsx,js,jsx}': (files) => {
    // Check cache
    const cacheKey = files.join(',');
    const cacheFile = `${cacheDir}/${hashSync('sha256', cacheKey)}.json`;

    if (existsSync(cacheFile)) {
      const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
      const unchanged = files.filter((f) => cached.includes(f));

      if (unchanged.length === files.length) {
        console.log('✅ All files cached, skipping lint');
        return [];
      }
    }

    // Run lint
    writeFileSync(cacheFile, JSON.stringify(files));
    return [`biome check --write ${files.join(' ')}`];
  },
};
```

## Integration Patterns

### With Husky

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
```

### With Biome

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["biome check --write"],
    "*.{json,css,md}": ["biome format --write"]
  }
}
```

### With Prettier

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,css,md}": ["prettier --write"]
  }
}
```

### CI/CD Integration

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx lint-staged
```

## Anti-Patterns

### ❌ DON'T
- Use slow operations in lint-staged: Keep it fast
- Skip lint-staged in CI: Always run checks
- Use complex operations: Keep hooks simple
- Ignore lint-staged failures: Fix issues before commit
- Use multiple linters: Choose one toolchain

### ✅ DO
- Use Biome for fast linting and formatting
- Keep lint-staged configuration simple
- Test lint-staged configuration
- Document exceptions
- Monitor performance

## Troubleshooting

### Common Issues

**Lint-staged Not Working**
```bash
# Check installation
npm list lint-staged

# Run manually
npx lint-staged

# Debug mode
DEBUG=lint-staged npx lint-staged
```

**Slow Linting**
```bash
# Profile execution
time npx lint-staged

# Optimize configuration
# Use Biome instead of ESLint + Prettier
# Skip unchanged files
```

**Files Not Found**
```bash
# Check staged files
git diff --cached --name-only

# Ensure correct patterns
npx lint-staged --debug
```

## Observability

### Lint Metrics

```bash
# Check lint results
npx lint-staged --verbose

# Debug configuration
DEBUG=lint-staged npx lint-staged

# Profile execution
time npx lint-staged
```

### Metrics to Track
- Lint execution time
- Files linted
- Errors found
- Auto-fix rate

## Production Checklist

- [ ] lint-staged configured
- [ ] Husky integration working
- [ ] Biome configured
- [ ] Fast execution verified
- [ ] CI/CD pipeline includes lint
- [ ] Team trained on usage
- [ ] Documentation updated
- [ ] Performance monitored

## CI/CD Integration

### GitHub Actions
```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
    - run: npm ci
    - run: npx lint-staged
```

### GitLab CI
```yaml
lint:
  stage: test
  script:
    - npm ci
    - npx lint-staged
```

## Team Conventions

- **Configuration Location**: `package.json` or `lint-staged.config.js`
- **Linting Tool**: Use Biome for speed
- **Formatting**: Use Biome for formatting
- **Performance**: Keep lint-staged fast
- **Documentation**: Keep config updated
- **Testing**: Test configuration regularly
- **CI/CD**: Run same checks in CI
