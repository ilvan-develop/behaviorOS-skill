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
├── AGENTS.md                         # Agent roles (only if the template ships one)
├── opencode.json                     # OpenCode config (PROJECT ROOT, no governance key)
├── .github/workflows/
│   └── oage-ci.yml                   # CI re-validates policy/secrets/tests independent of agent claims
├── scripts/                          # Governance scripts
│   ├── agent-loop.ps1, audit-logger.ps1, enforce.ps1, gates.ps1,
│   │   run-pipeline.ps1, skill-tracker.ps1, state-manager.ps1
│   ├── validate.mjs, lint.mjs        # Config validator + JSON/secret/anti-pattern scan
│   ├── audit-event.mjs               # Log confidence_declared / dependency_justification / review_approved
│   ├── handoff.mjs                   # Generate structured agent-to-agent handoff docs
│   ├── evidence-check.mjs            # Validate phase evidence before "completed"
│   ├── reviewer-check.mjs            # Validate independent review for critical phases
│   ├── oage-metrics.mjs              # Observability report
│   └── guards/
│       ├── permission-guard.ps1, skill-guard.ps1, state-guard.ps1, tool-guard.ps1
└── .opencode/
    ├── governance/
    │   ├── INSTRUCTIONS.md           # Absolute rules (+ OAGE rules 20-27 appended)
    │   ├── permissions-matrix.json, skill-gate.json, skill-gate-auto.json,
    │   │   tool-gate.json, state-machine.json, memory.json, audit.json,
    │   │   security-gates.json, production-gate.json
    │   └── anti-patterns.json, protected-resources.json, loop-detector.json,
    │       dependency-gate.json, truth-gate.json, context7-gate.json,
    │       version-pinning-gate.json, reviewer-gate.json, mcp-registry.json,
    │       handoff-schema.json, definition-of-done.json, ci-gate.json
    ├── plugins/
    │   ├── oage-enforce.js          # tool.execute.before — 10 runtime-enforced gates
    │   ├── oage-audit.js            # tool.execute.after — audit trail + gate-specific events
    │   └── lib/oage-lib.js          # Shared utilities
    ├── commands/                     # /oage-doctor, /oage-audit, /oage-review, /oage-research, /oage-release
    ├── skills/                       # Local skills
    ├── memory/
    │   ├── decisions.md, patterns.md, learnings.md, current-phase.md, scope-history.md
    └── audit/
        ├── skills-loaded.json        # Skill tracking (flat object format)
        ├── audit.jsonl               # Auto-created on first tool call
        └── loop-state.json           # Auto-created on first loop check
```

**Important:** `opencode.json` and `AGENTS.md` go to the **project root**, NOT to
`.opencode/governance/`. Scripts go to `<project-root>/scripts/`. Without
`.opencode/plugins/`, the JSON files under `.opencode/governance/` are advisory only — see
[INTEGRATION.md](INTEGRATION.md) for how the runtime enforcement actually works.

## Skills System

behaviorOS loads skills from multiple directories via `opencode.json`:

```json
{
  "skills": {
    "paths": [
      ".opencode/skills",      // Local skills (project-specific)
      ".agents/skills",        // Local agent skills
      "~/.agents/skills",      // Global user skills
      "~/.opencode/skills"     // Global opencode skills
    ]
  }
}
```

**Priority:** Local skills override global skills with the same name.

### Local vs Global

| Type | Path | Use Case |
|------|------|----------|
| **Local** | `.opencode/skills/`, `.agents/skills/` | Project-specific skills, custom rules |
| **Global** | `~/.agents/skills/`, `~/.opencode/skills/` | Reusable across all projects |

### Global Skills Inventory

Skills available in `~/.agents/skills/` for all projects:

| Domain | Skills |
|--------|--------|
| **Architecture** | enterprise-architecture, enterprise-backend, enterprise-frontend, enterprise-database |
| **DevOps** | enterprise-devops, cloudflare, cloudflare-one, workers-best-practices, durable-objects, wrangler |
| **Security** | enterprise-security, cloudflare-one-migrations |
| **AI/ML** | enterprise-ai-engineering, build-models, run-models, publish-models, compare-models, find-models, prompt-images, prompt-videos |
| **QA** | enterprise-qa, enterprise-performance, web-perf, enterprise-design-qa |
| **Product** | enterprise-product, enterprise-executive, enterprise-learning-design |
| **UI/UX** | enterprise-frontend, enterprise-ux-research, enterprise-visual-design, frontend-design |
| **Tools** | context7-mcp, skill-creator, find-skills, sandbox-stable, sandbox-next, sandbox-migrate-to-next |
| **Documentation** | enterprise-documentation |

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
4. **Check global skills** — Global skills (`~/.agents/skills/`) are available automatically across all projects
5. **Start development** — Use `/agent_loop --phase F0` to begin

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
- `opencode.json` — Agents, permissions, and skills paths
- `permissions-matrix.json` — Autonomy levels
- `skill-gate.json` — Required skills per phase
- `tool-gate.json` — Tool validations

**Skills configuration in `opencode.json`:**
```json
{
  "skills": {
    "paths": [".opencode/skills", ".agents/skills", "~/.agents/skills"]
  }
}
```

Add or remove paths based on where your skills are located.

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
