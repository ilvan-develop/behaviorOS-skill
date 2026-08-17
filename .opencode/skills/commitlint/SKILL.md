---
name: commitlint
description: Enterprise commitlint 21.x commit message validation with conventional commits, custom rules, and CI integration. Use when enforcing commit message standards or configuring commitlint.
metadata:
  stack: commitlint-21
  scope: code-quality
---

# commitlint Enterprise Commit Standards

## Overview

commitlint is a tool for validating commit messages against conventional commit standards. It ensures consistent commit messages across the team.

**When to Use:**
- Enforcing commit message standards
- Automating changelog generation
- Integrating with CI/CD pipelines
- Supporting semantic versioning
- Team collaboration on monorepos

**When NOT to Use:**
- Solo projects without team collaboration
- Projects not using conventional commits
- Non-JavaScript projects

## Architecture Patterns

### Project Structure
```
project/
├── commitlint.config.js    # commitlint configuration
├── .husky/
│   └── commit-msg          # Git hook
├── package.json
└── .github/
    └── workflows/
        └── ci.yml          # CI pipeline
```

## Complete Configuration

### commitlint.config.js (Production)

```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Type rules
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation changes
        'style',    // Code style changes (formatting, etc.)
        'refactor', // Code refactoring
        'perf',     // Performance improvements
        'test',     // Adding tests
        'build',    // Build system changes
        'ci',       // CI configuration changes
        'chore',    // Other changes
        'revert',   // Revert a commit
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],

    // Scope rules
    'scope-case': [2, 'always', 'lower-case'],
    'scope-empty': [1, 'never'],
    'scope-enum': [
      1,
      'always',
      [
        'api',
        'web',
        'ui',
        'auth',
        'db',
        'config',
        'deps',
        'ci',
        'docs',
        'test',
        'build',
        'release',
      ],
    ],

    // Subject rules
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 100],

    // Header rules
    'header-max-length': [2, 'always', 100],

    // Body rules
    'body-leading-blank': [1, 'always'],
    'body-max-line-length': [2, 'always', 120],

    // Footer rules
    'footer-leading-blank': [1, 'always'],
    'footer-max-line-length': [2, 'always', 120],
  },
  plugins: [
    {
      rules: {
        // Custom rule: require issue reference
        'references-empty': (parsed) => {
          const hasIssueRef =
            parsed.references &&
            parsed.references.length > 0 &&
            parsed.references.some((ref) => ref.issue);

          if (!hasIssueRef) {
            return [false, 'Commit message must reference an issue (e.g., Closes #123)'];
          }
          return [true];
        },
      },
    },
  ],
  rules: {
    // Enable custom rule
    'references-empty': [2, 'never'],
  },
};
```

### package.json Scripts

```json
{
  "scripts": {
    "commit": "cz",
    "commitlint": "commitlint --from HEAD~1 --to HEAD --verbose",
    "commitlint:ci": "commitlint --from ${{ github.event.pull_request.base.sha }} --to HEAD --verbose"
  },
  "devDependencies": {
    "@commitlint/cli": "^21.2.1",
    "@commitlint/config-conventional": "^21.2.0",
    "commitizen": "^4.3.0",
    "@commitlint/prompt-commitizen": "^21.2.0"
  },
  "config": {
    "commitizen": {
      "path": "@commitlint/prompt-commitizen"
    }
  }
}
```

### Husky Integration

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1

# .husky/commit-msg (with validation)
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx --no -- commitlint --edit $1
if [ $? -ne 0 ]; then
  echo "❌ Commit message validation failed"
  echo "Please follow conventional commits format"
  echo "Example: feat: add new feature"
  exit 1
fi
```

## Security Hardening

### Secure Commit Validation

```javascript
// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Prevent sensitive data in commits
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 120],

    // Custom rule: prevent secrets
    'no-secrets': [
      2,
      'always',
      {
        patterns: [
          /password/i,
          /secret/i,
          /api[_-]?key/i,
          /token/i,
          /credential/i,
        ],
      },
    ],
  },
  plugins: [
    {
      rules: {
        'no-secrets': ({ raw }) => {
          const patterns = [
            /password/i,
            /secret/i,
            /api[_-]?key/i,
            /token/i,
            /credential/i,
          ];

          for (const pattern of patterns) {
            if (pattern.test(raw)) {
              return [false, 'Commit message contains potential secrets'];
            }
          }
          return [true];
        },
      },
    },
  ],
};
```

## Performance Optimization

### Fast Validation

```bash
# Validate only recent commits
npx commitlint --from HEAD~1 --to HEAD

# Validate specific commit
npx commitlint --from abc123

# Validate in CI (only PR commits)
npx commitlint --from ${{ github.event.pull_request.base.sha }} --to HEAD
```

### Caching Strategies

```bash
# Cache commitlint results
commitlint --cache-location .commitlint-cache

# Clear cache
rm -rf .commitlint-cache
```

## Integration Patterns

### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - name: Validate commits
        run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to HEAD --verbose
```

### With Changesets

```json
// package.json
{
  "scripts": {
    "changeset": "changeset",
    "version": "changeset version",
    "release": "changeset publish"
  }
}
```

### With Husky

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1

# .husky/pre-push
npm run typecheck
npm run test
```

## Anti-Patterns

### ❌ DON'T
- Skip commit validation: Always validate
- Use vague commit messages: Be specific
- Skip issue references: Always reference issues
- Ignore breaking changes: Use BREAKING CHANGE footer
- Skip scope: Use appropriate scope

### ✅ DO
- Use conventional commits format
- Write clear, concise messages
- Reference issues in body
- Use appropriate type and scope
- Test commit messages in CI

## Troubleshooting

### Common Issues

**Validation Failing**
```bash
# Check commit format
git log --oneline -1

# Test commitlint
npx commitlint --from HEAD~1 --to HEAD --verbose

# Fix commit message
git commit --amend -m "feat: add new feature"
```

**Husky Not Working**
```bash
# Reinstall husky
npx husky install

# Add hook
npx husky add .husky/commit-msg "npx --no -- commitlint --edit \$1"
```

**CI Pipeline Failing**
```bash
# Check CI configuration
cat .github/workflows/ci.yml

# Test locally
npx commitlint --from ${{ github.event.pull_request.base.sha }} --to HEAD
```

## Observability

### Commit Metrics

```bash
# Check commit history
git log --oneline -20

# Validate all commits
npx commitlint --from main --to HEAD

# Check commitlint config
npx commitlint --print-config
```

### Metrics to Track
- Commit validation success rate
- Common commit message errors
- Team adoption rate
- CI pipeline performance

## Production Checklist

- [ ] commitlint configured
- [ ] Husky hooks setup
- [ ] CI/CD pipeline validates
- [ ] Team trained on conventions
- [ ] Custom rules configured
- [ ] Issue reference required
- [ ] Breaking changes documented
- [ ] Changelog generation working

## CI/CD Integration

### GitHub Actions
```yaml
commitlint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
    - run: npm ci
    - name: Validate commits
      run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to HEAD --verbose
```

### GitLab CI
```yaml
commitlint:
  stage: test
  script:
    - npm ci
    - npx commitlint --from HEAD~1 --to HEAD --verbose
```

## Team Conventions

- **Configuration Location**: Root `commitlint.config.js`
- **Commit Format**: `type(scope): description`
- **Types**: Use predefined types only
- **Scopes**: Use project-specific scopes
- **Issue References**: Always reference issues
- **Breaking Changes**: Use BREAKING CHANGE footer
- **Documentation**: Keep commitlint docs updated
- **Training**: Regular team training on conventions
