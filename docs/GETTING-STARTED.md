# Getting Started with behaviorOS

> Quick guide to set up behaviorOS for your project

## Prerequisites

- Node.js 18+
- pnpm 8+ (recommended)
- OpenCode installed

## Installation

### Option 1: Interactive Setup (Recommended)

```bash
# Navigate to your project directory
cd your-project

# Run the setup wizard
node /path/to/behaviorOS/scripts/init.mjs
```

The wizard will guide you through:
1. Project name and description
2. Template selection
3. Critical phases configuration
4. Automatic installation

### Option 2: From Template

```bash
# Install from a specific template
node /path/to/behaviorOS/scripts/install.mjs --template=saas-b2b
```

Available templates:
- `saas-b2b` — B2B SaaS application
- `saas-b2c` — B2C SaaS application
- `fintech` — Financial technology
- `ecommerce` — E-commerce platform
- `marketplace` — Multi-sided marketplace
- `healthcare` — Healthcare application
- `education` — Education platform
- `custom` — Custom template

### Option 3: From Blueprint

```bash
# Install from an existing blueprint
node /path/to/behaviorOS/scripts/install.mjs --blueprint=./blueprint/
```

## What Gets Installed

After installation, your project will have:

```
your-project/
├── opencode.json                    # Central configuration
└── .opencode/
    ├── governance/
    │   ├── INSTRUCTIONS.md          # Absolute rules
    │   ├── permissions-matrix.json  # Permission matrix
    │   ├── skill-gate.json          # Skill validation
    │   ├── tool-gate.json           # Tool validation
    │   ├── state-machine.json       # Orchestrator lifecycle
    │   ├── memory.json              # Memory configuration
    │   ├── audit.json               # Audit configuration
    │   ├── security-gates.json      # Security validations
    │   └── production-gate.json     # Production readiness
    ├── memory/
    │   ├── decisions.md
    │   ├── patterns.md
    │   ├── learnings.md
    │   ├── current-phase.md
    │   └── scope-history.md
    └── audit/
```

## Validation

After installation, validate the configuration:

```bash
node /path/to/behaviorOS/scripts/validate.mjs
```

This will check:
- All required files are present
- JSON files are valid
- Configuration is correct

## Next Steps

1. **Review configuration** — Open `.opencode/governance/INSTRUCTIONS.md` and customize for your project
2. **Define your rules** — Update the absolute rules in INSTRUCTIONS.md
3. **Set up phases** — Configure your roadmap phases
4. **Start development** — Use `/agent_loop --phase F0` to begin

## Quick Start Example

```bash
# 1. Create project directory
mkdir my-saas
cd my-saas

# 2. Initialize git
git init

# 3. Run behaviorOS setup
node /path/to/behaviorOS/scripts/init.mjs

# 4. Start development
/agent_loop --phase F0
```

## Customization

### Customizing Rules

Edit `.opencode/governance/INSTRUCTIONS.md` to add your project-specific rules.

### Customizing Templates

Copy an existing template and modify:
- `opencode.json` — Agents and permissions
- `permissions-matrix.json` — Autonomy levels
- `skill-gate.json` — Required skills
- `tool-gate.json` — Tool validations

### Adding Phases

Edit `.opencode/governance/state-machine.json` to add or modify phases.

## Troubleshooting

### "Template not found" error

Ensure you're using a valid template name. Available templates:
- saas-b2b, saas-b2c, fintech, ecommerce, marketplace, healthcare, education, custom

### "Invalid JSON" error

Run the validator to identify issues:
```bash
node /path/to/behaviorOS/scripts/validate.mjs
```

### Governance directory already exists

The installer will overwrite existing files. Back up your configuration first if needed.

## Support

- [Documentation](README.md)
- [Templates Guide](TEMPLATES.md)
- [Customization](CUSTOMIZATION.md)
- [GitHub Issues](https://github.com/behaviorOS/behaviorOS/issues)
