---
name: changesets
description: Enterprise Changesets 2.x version management for monorepos with semantic versioning, changelogs, and publish workflows. Use when managing package versions, creating releases, or publishing packages.
metadata:
  stack: changesets-2
  scope: monorepo
---

# Changesets Enterprise Versioning

## Overview

Changesets is a tool for managing package versions in monorepos. It helps create releases, update changelogs, and publish packages with semantic versioning.

**When to Use:**
- Monorepos with multiple packages
- Needing automated versioning
- Creating changelogs automatically
- Publishing packages to npm
- Managing breaking changes

**When NOT to Use:**
- Single-package projects
- Projects without versioning needs
- Non-JavaScript projects

## Architecture Patterns

### Project Structure
```
finpay/
├── .changeset/
│   ├── config.json         # Changeset configuration
│   └── *.md                # Changeset files
├── apps/
│   └── web/
├── packages/
│   ├── shared/
│   ├── ui/
│   └── config/
└── package.json
```

## Complete Configuration

### Setup

```bash
# Initialize changesets
npx @changesets/cli init

# This creates:
# - .changeset/config.json
# - .changeset/README.md
```

### .changeset/config.json (Production)

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": [
    "@changesets/changelog-github",
    { "repo": "finpay/finpay" }
  ],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@finpay/test-utils"],
  "___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH": {
    "onlyUpdatePeerDependentsWhenOutOfRange": true
  }
}
```

### Creating a Changeset

```bash
# Create a changeset
npx changeset

# Follow prompts:
# 1. Select packages to change
# 2. Select bump type (patch/minor/major)
# 3. Write changelog summary
```

### Changeset File

```markdown
---
"@finpay/shared": minor
"@finpay/web": patch
---

Added new user profile API endpoints with improved error handling
```

### Version Command

```bash
# Apply changesets and update versions
npx changeset version

# This updates:
# - package.json versions
# - CHANGELOG.md files
# - Removes consumed .changeset/*.md files
```

### Publish

```bash
# Publish changed packages
npx changeset publish

# Or with npm
npm publish --access public

# Dry run
npx changeset publish --dry-run
```

## Security Hardening

### Safe Publishing

```bash
# Verify packages before publishing
npx changeset publish --dry-run

# Check what will be published
npx changeset status

# Ensure clean working directory
git status
```

### Access Control

```json
{
  "access": "restricted",
  "baseBranch": "main"
}
```

## Performance Optimization

### Fast Versioning

```bash
# Only version changed packages
npx changeset version

# Skip changelog generation (faster)
npx changeset version --no-changelog

# Dry run to see changes
npx changeset version --dry-run
```

### Caching Strategies

```bash
# Cache published packages
npx changeset publish --registry https://registry.npmjs.org

# Use local registry for testing
npx changeset publish --registry http://localhost:4873
```

## Integration Patterns

### CI/CD Workflow

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - name: Create Release PR
        uses: changesets/action@v1
        with:
          version: npx changeset version
          publish: npx changeset publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### With Turborepo

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "version": {
      "cache": false
    },
    "publish": {
      "cache": false
    }
  }
}
```

### package.json Scripts

```json
{
  "scripts": {
    "changeset": "changeset",
    "version": "changeset version",
    "release": "changeset publish",
    "release:dry": "changeset publish --dry-run"
  }
}
```

## Anti-Patterns

### ❌ DON'T
- Commit version bumps directly: Use changesets
- Skip changelog updates: Always update CHANGELOG.md
- Use wrong bump types: Use patch for fixes, minor for features, major for breaking
- Publish without dry run: Always test first
- Ignore test packages: Use `ignore` config

### ✅ DO
- Run `npx changeset` before every PR
- Use semantic versioning correctly
- Write meaningful changelog entries
- Test with dry run before publishing
- Use `linked` for packages that version together
- Use `fixed` for packages that must stay in sync

## Troubleshooting

### Common Issues

**Changeset Not Created**
```bash
# Check changeset status
npx changeset status

# Ensure .changeset directory exists
ls -la .changeset/
```

**Version Not Updated**
```bash
# Check pending changesets
npx changeset status

# Apply changesets manually
npx changeset version
```

**Publish Failed**
```bash
# Check npm authentication
npm whoami

# Verify package.json
cat package.json | grep -E '"name"|"version"'

# Dry run publish
npx changeset publish --dry-run
```

## Observability

### Release Metrics

```bash
# Check changeset status
npx changeset status

# View pending changes
npx changeset status --verbose

# Dry run version
npx changeset version --dry-run
```

### Metrics to Track
- Number of changesets created
- Version bumps per release
- Changelog generation time
- Publish success rate

## Production Checklist

- [ ] Changeset config configured
- [ ] CI/CD workflow setup
- [ ] npm authentication configured
- [ ] Changelog generation working
- [ ] Versioning strategy documented
- [ ] Test packages ignored
- [ ] Dry run tested
- [ ] Team trained on changesets

## CI/CD Integration

### GitHub Actions
```yaml
release:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
    - run: npm ci
    - name: Create Release PR
      uses: changesets/action@v1
      with:
        version: npx changeset version
        publish: npx changeset publish
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### GitLab CI
```yaml
release:
  stage: release
  script:
    - npm ci
    - npx changeset version
    - npx changeset publish
  variables:
    NPM_TOKEN: $NPM_TOKEN
```

## Team Conventions

- **Configuration Location**: `.changeset/config.json`
- **Changeset Creation**: Before every PR
- **Versioning**: Follow semantic versioning
- **Changelog**: Write meaningful entries
- **Publishing**: Use CI/CD automation
- **Testing**: Always dry run before publish
- **Documentation**: Keep changeset docs updated
