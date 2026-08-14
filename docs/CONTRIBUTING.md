# Contributing to behaviorOS

> Thank you for your interest in contributing to behaviorOS!

## Overview

behaviorOS is an open-source project and we welcome contributions from the community. This guide will help you get started.

## Ways to Contribute

### 1. Code Contributions

- Fix bugs
- Add new features
- Improve existing functionality
- Add tests

### 2. Documentation

- Improve existing docs
- Add examples
- Fix typos
- Translate to other languages

### 3. Templates

- Create new project templates
- Improve existing templates
- Add industry-specific templates

### 4. Bug Reports

- Report issues you find
- Provide reproduction steps
- Suggest fixes

### 5. Feature Requests

- Suggest new features
- Provide use cases
- Help prioritize

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+ (recommended)
- Git

### Clone Repository

```bash
git clone https://github.com/behaviorOS/behaviorOS.git
cd behaviorOS
```

### Install Dependencies

```bash
pnpm install
```

### Run Tests

```bash
pnpm test
```

## Project Structure

```
behaviorOS/
├── SKILL.md                    # Main skill file
├── README.md                   # Public documentation
├── package.json                # Package metadata
├── LICENSE                     # MIT License
│
├── templates/                  # Project templates
│   ├── saas-b2b/
│   ├── saas-b2c/
│   ├── fintech/
│   ├── ecommerce/
│   ├── marketplace/
│   ├── healthcare/
│   ├── education/
│   └── custom/
│
├── scripts/                    # Setup scripts
│   ├── init.mjs
│   ├── install.mjs
│   └── validate.mjs
│
├── core/                       # Core logic
│   ├── generator.mjs
│   ├── validator.mjs
│   ├── installer.mjs
│   └── prompts.mjs
│
├── tests/                      # Test files
│   └── *.test.js
│
└── docs/                       # Documentation
    ├── GETTING-STARTED.md
    ├── TEMPLATES.md
    ├── CUSTOMIZATION.md
    └── CONTRIBUTING.md
```

## Making Changes

### 1. Create Branch

```bash
git checkout -b feature/your-feature
```

### 2. Make Changes

- Follow existing code style
- Add tests for new functionality
- Update documentation

### 3. Run Tests

```bash
pnpm test
```

### 4. Commit Changes

```bash
git commit -m "feat: add new feature"
```

Use [Conventional Commits](https://www.conventionalcommits.org/) format:
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `style:` — Code style
- `refactor:` — Code refactoring
- `test:` — Tests
- `chore:` — Maintenance

### 5. Push Changes

```bash
git push origin feature/your-feature
```

### 6. Create Pull Request

- Provide clear description
- Reference related issues
- Include screenshots if applicable

## Code Style

### JavaScript/Node.js

- Use ES modules (import/export)
- Use meaningful variable names
- Add comments for complex logic
- Keep functions small and focused

### JSON

- Use 2-space indentation
- Use meaningful keys
- Validate JSON before committing

### Markdown

- Use clear headings
- Include code examples
- Keep line length reasonable

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test
node --test tests/validate-config.test.js
```

### Writing Tests

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('My Feature', () => {
  it('should do something', () => {
    const result = myFunction();
    assert.strictEqual(result, expected);
  });
});
```

## Documentation

### Writing Docs

- Use clear, concise language
- Include code examples
- Provide step-by-step instructions
- Update table of contents

### Documentation Structure

- **GETTING-STARTED.md** — Quick start guide
- **TEMPLATES.md** — Template documentation
- **CUSTOMIZATION.md** — Customization guide
- **CONTRIBUTING.md** — This file

## Templates

### Creating a Template

1. Copy existing template
2. Modify configuration files
3. Test with sample project
4. Update documentation

### Template Requirements

- Must include all required governance files
- Must be validated with `validate.mjs`
- Must include README.md in blueprint/
- Must follow naming conventions

## Code of Conduct

### Our Pledge

- Be respectful
- Be inclusive
- Be constructive
- Be professional

### Unacceptable Behavior

- Harassment
- Discrimination
- Trolling
- Spam

## Questions?

- Open an issue
- Start a discussion
- Contact maintainers

## Thank You!

Thank you for contributing to behaviorOS!
