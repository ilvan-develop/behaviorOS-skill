# behaviorOS Quick Start

> Get up and running in 5 minutes

## Prerequisites

- Node.js 18+
- OpenCode installed

## Option 1: Interactive Setup (Recommended)

```bash
# Navigate to your project
cd your-project

# Run the setup wizard
node /path/to/behaviorOS/scripts/init.mjs

# Follow the prompts:
# 1. Enter project name
# 2. Enter project description
# 3. Select template (fintech, saas-b2b, etc.)
# 4. Select critical phases
# 5. Confirm installation
```

## Option 2: Quick Install

```bash
# Navigate to your project
cd your-project

# Install from template
node /path/to/behaviorOS/scripts/install.mjs --template=fintech

# Validate installation
node /path/to/behaviorOS/scripts/validate.mjs
```

## Option 3: Via OpenCode

```bash
# Install behaviorOS skill
opencode skill add behaviorOS

# Initialize in your project
/behaviorOS init

# Or install from template
/behaviorOS install --template=fintech
```

## What Gets Installed

```
your-project/
├── AGENTS.md                         # Agent roles and governance rules
├── opencode.json                     # Central configuration
├── scripts/                          # Governance scripts
│   ├── agent-loop.ps1                # Main orchestrator loop
│   ├── audit-logger.ps1              # Audit logging
│   ├── enforce.ps1                   # Enforcement script
│   ├── gates.ps1                     # Gate checks
│   ├── run-pipeline.ps1              # Pipeline runner
│   ├── skill-tracker.ps1             # Skill tracking
│   ├── state-manager.ps1             # State management
│   ├── validate.mjs                  # Configuration validator
│   └── guards/
│       ├── permission-guard.ps1      # Permission checks
│       ├── skill-guard.ps1           # Skill validation
│       ├── state-guard.ps1           # State validation
│       └── tool-guard.ps1            # Tool validation
└── .opencode/
    ├── governance/
    │   ├── INSTRUCTIONS.md           # Absolute rules
    │   ├── permissions-matrix.json   # Permission matrix
    │   ├── skill-gate.json           # Skill validation
    │   ├── tool-gate.json            # Tool validation
    │   ├── state-machine.json        # Orchestrator lifecycle
    │   ├── memory.json               # Memory configuration
    │   ├── audit.json                # Audit configuration
    │   ├── security-gates.json       # Security validations
    │   └── production-gate.json      # Production readiness
    ├── memory/
    │   ├── decisions.md
    │   ├── patterns.md
    │   ├── learnings.md
    │   ├── current-phase.md
    │   └── scope-history.md
    └── audit/
```

## Next Steps

### 1. Review Configuration

Open `.opencode/governance/INSTRUCTIONS.md` and customize for your project:

```markdown
## Regras Imutáveis

### 1. Your Custom Rule
- Description of your rule
- Why it's important
```

### 2. Define Your Phases

Edit `.opencode/governance/state-machine.json`:

```json
{
  "phaseStates": {
    "F0": {"status": "pending", "critical": false},
    "F1": {"status": "pending", "critical": false},
    "F2": {"status": "pending", "critical": true},
    "F3": {"status": "pending", "critical": true}
  }
}
```

### 3. Start Development

```bash
# Start with phase F0
/agent_loop --phase F0
```

## Available Templates

| Template | Best For | Critical Phases |
|----------|----------|-----------------|
| `saas-b2b` | Business software | F2, F3 |
| `saas-b2c` | Consumer apps | F2, F3 |
| `fintech` | Financial apps | F2, F3, F5, F6 |
| `ecommerce` | Online stores | F3, F4 |
| `marketplace` | Two-sided platforms | F3, F4 |
| `healthcare` | Medical apps | F2, F3, F5 |
| `education` | Learning platforms | F2, F3 |
| `custom` | Start from scratch | Configurable |

## Customization

### Adding Custom Rules

Edit `.opencode/governance/INSTRUCTIONS.md`:

```markdown
### 1. Code Style
- Use camelCase for variables
- Use PascalCase for classes
- Maximum line length: 100 characters

### 2. Git Workflow
- Never commit directly to main
- Use feature branches
- Squash commits on merge
```

### Adding Custom Skills

1. Create skill directory:
```bash
mkdir -p .opencode/skills/my-skill
```

2. Create `SKILL.md`:
```markdown
---
name: my-skill
description: My custom skill
---

# My Skill

## Overview
Description of your skill.

## When to Use
- Use case 1
- Use case 2
```

3. Reference in `skill-gate.json`:
```json
{
  "requiredSkills": {
    "F2": ["my-skill", "other-skill"]
  }
}
```

## Validation

After installation, validate your configuration:

```bash
node /path/to/behaviorOS/scripts/validate.mjs
```

This will check:
- All required files are present
- JSON files are valid
- Configuration is correct

## Troubleshooting

### "Template not found" error

Ensure you're using a valid template name:
```bash
node /path/to/behaviorOS/scripts/install.mjs --help
```

### "Invalid JSON" error

Check your JSON syntax:
```bash
cat .opencode/governance/opencode.json | jq .
```

### Governance directory already exists

The installer will overwrite existing files. Back up your configuration first if needed.

## Support

- [Documentation](README.md)
- [Templates Guide](TEMPLATES.md)
- [Customization](CUSTOMIZATION.md)
- [GitHub Issues](https://github.com/behaviorOS/behaviorOS/issues)

## Next Steps

- [Templates Guide](TEMPLATES.md)
- [Customization](CUSTOMIZATION.md)
- [API Reference](API.md)
