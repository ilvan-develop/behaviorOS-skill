---
name: biome
description: Enterprise Biome 2.x linter and formatter configuration for JavaScript, TypeScript, JSON, CSS. Use when setting up, configuring, or fixing Biome linting/formatting issues, or when adding new rules.
metadata:
  stack: biome-2
  scope: code-quality
---

# Biome Enterprise Configuration

## Overview

Biome is a high-performance toolchain for JavaScript, TypeScript, JSX, and JSON. It combines linting, formatting, and more into a single tool with zero configuration.

**When to Use:**
- Replacing ESLint + Prettier with a faster, unified tool
- Monorepo code consistency enforcement
- Pre-commit hooks for immediate feedback
- CI/CD pipelines requiring fast linting
- Projects needing both linting and formatting

**When NOT to Use:**
- Projects requiring highly custom ESLint plugins not available in Biome
- Teams deeply invested in ESLint ecosystem
- Projects needing complex rule overrides per directory

## Architecture Patterns

### Project Structure
```
project/
├── biome.json              # Main configuration
├── biome.jsonc             # With comments (optional)
├── src/
│   ├── components/         # React components
│   ├── services/           # Business logic
│   └── utils/              # Utilities
├── .github/
│   └── workflows/
│       └── ci.yml          # CI pipeline
└── package.json
```

### Configuration Hierarchy
1. `biome.json` in project root
2. `.biome.json` (alternative name)
3. `biome.jsonc` (with comments support)
4. CLI flags override config file

## Complete Configuration

### biome.json (Production)

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.6/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "root": true
  },
  "files": {
    "ignoreUnknown": false,
    "ignore": [
      "node_modules",
      "dist",
      "coverage",
      ".next",
      ".nuxt",
      "*.min.js",
      "*.min.css",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml"
    ],
    "include": [
      "src/**/*.{ts,tsx,js,jsx}",
      "*.json",
      "*.css"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "preset": "recommended",
      "correctness": {
        "noUnusedImports": "warn",
        "noUnusedVariables": "warn",
        "useExhaustiveDependencies": "warn",
        "useHookAtTopLevel": "error",
        "noConstAssign": "error",
        "noConstructorReturn": "error",
        "noEmptyCharacterClassInRegex": "error",
        "noEmptyPattern": "error",
        "noGlobalObjectCalls": "error",
        "noInnerDeclarations": "error",
        "noInvalidConstructorSuper": "error",
        "noNewSymbol": "error",
        "noNonoctalDecimalEscape": "error",
        "noPrecisionLoss": "error",
        "noSelfAssign": "error",
        "noSetterReturn": "error",
        "noStringCaseMismatch": "error",
        "noSwitchDeclarations": "error",
        "noUndeclaredVariables": "error",
        "noUnreachable": "error",
        "noUnreachableSuper": "error",
        "noUnsafeFinally": "error",
        "noUnsafeOptionalChaining": "error",
        "useArrayLiterals": "error",
        "useYield": "error"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error",
        "useImportType": "error",
        "noNamespace": "error",
        "noNamespaceUsing": "error",
        "useArrowFunction": "error",
        "useBlockStatements": "error",
        "useShorthandAssign": "error",
        "useShorthandPropertyAssignment": "error",
        "useSingleCaseStatement": "error",
        "useSingleVarDeclarator": "error",
        "noUnusedTemplateLiteral": "error",
        "useDefaultSwitchClauseLast": "error",
        "useEnumInitializers": "error",
        "useExponentiationOperator": "error",
        "useNumericalLiterals": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noConsole": "warn",
        "noDebugger": "error",
        "noDoubleEquals": "error",
        "noGlobalAssign": "error",
        "noLabelVar": "error",
        "noProto": "error",
        "noRedeclare": "error",
        "noShadowRestrictedNames": "error",
        "noUnsafeDeclarationMerging": "error",
        "useGetterReturn": "error",
        "useIsNan": "error",
        "useValidTypeof": "error"
      },
      "a11y": {
        "useAltText": "error",
        "useButtonType": "error",
        "useValidAnchor": "error",
        "useAriaProps": "error",
        "useAriaProptypes": "error",
        "useValidAriaRole": "error",
        "useValidLang": "error",
        "noAutofocus": "warn"
      },
      "security": {
        "noGlobalEval": "error",
        "noProto": "error"
      }
    },
    "ignore": [
      "*.test.ts",
      "*.test.tsx",
      "*.spec.ts",
      "*.spec.tsx"
    ]
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always",
      "arrowParentheses": "always"
    },
    "parser": {
      "unsafeParameterDecoratorsEnabled": false
    }
  },
  "json": {
    "formatter": {
      "trailingCommas": "none"
    },
    "parser": {
      "allowComments": true,
      "allowTrailingCommas": true
    }
  },
  "css": {
    "formatter": {
      "indentStyle": "space",
      "indentWidth": 2
    },
    "linter": {
      "enabled": true
    }
  },
  "assist": {
    "enabled": true,
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  },
  "overrides": [
    {
      "include": ["*.test.ts", "*.test.tsx", "*.spec.ts", "*.spec.tsx"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off"
          },
          "style": {
            "noNonNullAssertion": "off"
          }
        }
      }
    },
    {
      "include": ["**/*.json"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off"
          }
        }
      }
    }
  ]
}
```

## Security Hardening

### Dangerous Rules to Enable
```json
{
  "security": {
    "noGlobalEval": "error",
    "noProto": "error",
    "noObjCalls": "error",
    "noOctalEscape": "error"
  }
}
```

### Content Security Policy Considerations
- Biome enforces safe coding patterns
- Use `noGlobalEval` to prevent eval attacks
- Enable `noProto` to prevent prototype pollution

## Performance Optimization

### Fast Execution Settings
```json
{
  "files": {
    "maxSize": 2048,
    "ignoreUnknown": true
  },
  "formatter": {
    "lineWidth": 100
  }
}
```

### Caching Strategies
```bash
# Biome has built-in caching
# First run: full lint
npx biome check .

# Subsequent runs: incremental
npx biome check . --changed
```

## Integration Patterns

### package.json Scripts
```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "lint:unsafe": "biome check --write --unsafe .",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "typecheck": "tsc --noEmit",
    "validate": "npm run lint && npm run typecheck"
  }
}
```

### Pre-commit Integration (lint-staged)
```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["biome check --write --no-errors-on-unmatched"],
    "*.json": ["biome format --write"],
    "*.css": ["biome format --write"]
  }
}
```

### Husky Hook
```bash
#!/bin/sh
# .husky/pre-commit
npx lint-staged
```

### CI/CD Pipeline
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
      - run: npm ci
      - run: npx biome check .
```

## Anti-Patterns

### ❌ DON'T
- Disable Biome in CI: Always run in CI
- Use `--unsafe` without review: Review unsafe fixes manually
- Ignore files in `.gitignore`: Let Biome use `.gitignore`
- Mix Biome with ESLint: Choose one toolchain
- Skip type-checking: Run `tsc` separately

### ✅ DO
- Use `preset: "recommended"` as baseline
- Enable `vcs.enabled: true` for git integration
- Set `lineWidth: 100` for consistency
- Use `organizeImports` for auto-sorting
- Run `biome check --write` in CI for consistent formatting
- Disable `noConsole` in server code, keep in client code
- Use overrides for test files and JSON

## Troubleshooting

### Common Issues

**Import Organization Conflicts**
```bash
# Fix: Run organize imports first
npx biome check --write .
```

**Formatter Inconsistencies**
```bash
# Fix: Ensure consistent config across team
npx biome check --config-validator=basic .
```

**Slow Performance**
```bash
# Fix: Use ignore patterns effectively
npx biome check . --files-ignore-unknown=true
```

## Observability

### Logging Configuration
```typescript
// Biome CLI output
npx biome check . --verbose
```

### Metrics to Track
- Lint execution time
- Number of errors/warnings
- Auto-fix rate
- Import organization frequency

## Production Checklist

- [ ] `biome.json` configured with proper schema
- [ ] VCS integration enabled
- [ ] Proper ignore patterns set
- [ ] Linter rules configured for project needs
- [ ] Formatter settings consistent
- [ ] Pre-commit hooks configured
- [ ] CI/CD pipeline includes Biome
- [ ] Team trained on Biome usage
- [ ] Overrides configured for test files
- [ ] Performance optimized with caching

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
    - run: npx biome check .
    - run: npx biome format --check .
```

### GitLab CI
```yaml
lint:
  stage: test
  script:
    - npm ci
    - npx biome check .
```

## Team Conventions

- **Configuration Location**: Root `biome.json`
- **Commit Messages**: Use conventional commits format
- **Branch Protection**: Require Biome check in PRs
- **Code Review**: Address all Biome warnings before merge
- **Documentation**: Keep Biome config updated in README
- **Rule Customization**: Document any rule changes in PR description
