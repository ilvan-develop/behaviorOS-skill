---
name: behaviorOS
description: Autonomous development governance system with skill gates, tool gates, permissions, state machine, memory, audit trail, and compliance. Sets up governance for any software project with three-level autonomy model.
metadata:
  scope: governance
  version: "1.0.0"
  author: "Ilvan Joaquim"
  homepage: "https://github.com/behaviorOS/behaviorOS"
---

# behaviorOS

> Autonomous Development Governance System

## What is behaviorOS

behaviorOS is a governance system for autonomous software development. It enables AI agents to work independently while maintaining control through:

- **Three-level autonomy model** — L1 (Routine), L2 (Auto-Expand), L3 (Escalate)
- **Skill gates** — Validates skills before task execution
- **Tool gates** — Validates tools before usage
- **Permission matrix** — Defines what agents can do
- **State machine** — Manages orchestrator lifecycle
- **Memory** — Maintains context between phases
- **Audit trail** — Records all actions
- **Compliance** — Supports regulatory requirements

## When to use behaviorOS

- Starting a new software project
- Multiple AI agents working together
- Need autonomous development with controls
- Require audit trail and compliance
- Building critical systems (fintech, healthcare, etc.)

## Quick Start

### Option 1: Interactive Setup
```
/behaviorOS init
```

### Option 2: From Blueprint
```
/behaviorOS install --blueprint ./blueprint/
```

### Option 3: From Template
```
/behaviorOS install --template saas-b2b
```

## Available Templates

| Template | Description | Use Case |
|----------|-------------|----------|
| `saas-b2b` | B2B SaaS application | Business software, dashboards |
| `saas-b2c` | B2C SaaS application | Consumer apps, social platforms |
| `fintech` | Financial technology | Payments, banking, compliance |
| `ecommerce` | E-commerce platform | Online stores, marketplaces |
| `marketplace` | Multi-sided marketplace | Two-sided platforms |
| `healthcare` | Healthcare application | Medical, health tech |
| `education` | Education platform | LMS, courses, learning |
| `custom` | Custom template | Start from scratch |

## Commands

| Command | Description |
|---------|-------------|
| `/behaviorOS init` | Interactive setup wizard |
| `/behaviorOS install --template <type>` | Install from template |
| `/behaviorOS install --blueprint <path>` | Install from blueprint |
| `/behaviorOS validate` | Validate current configuration |
| `/behaviorOS status` | Show current governance status |
| `/behaviorOS migrate` | Migrate to new version |

## What Gets Installed

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
    ├── plugins/
    │   └── audit.mjs
    └── skills/                      # Compliance skills
        ├── compliance/
        └── ...
```

## Three-Level Autonomy Model

### L1: Routine (No approval needed)
- Create code following patterns
- Write tests
- Run lint, typecheck, build
- Create standard endpoints

### L2: Auto-Expand (Log for review)
- Add auxiliary fields
- Create auxiliary services
- Refactor existing code
- **Requires:** Audit trail log for review

### L3: Escalate (Wait for human decision)
- New unplanned dependency
- Schema change affecting existing
- Compliance uncertainty
- Security implications
- **Requires:** Explicit human approval

## Architecture

```
HUMAN (approves scope)
    │
    ▼
/behaviorOS (initiates loop)
    │
    ▼
ORCHESTRATOR (works autonomously)
    │
    ├── Skill Gate (validates skills)
    ├── Tool Gate (validates tools)
    ├── Permission Gate (validates permissions)
    │
    ▼
EXECUTION → AUDIT → MEMORY
```

## Customization

### Custom Template
Create your own template in `templates/custom/`:
1. Copy an existing template
2. Modify `opencode.json` for your needs
3. Update `INSTRUCTIONS.md` with your rules
4. Adjust `permissions-matrix.json` for your phases

### Template Variables
Templates support these variables:
- `{{PROJECT_NAME}}` — Project name
- `{{PROJECT_DESCRIPTION}}` — Project description
- `{{CRITICAL_PHASES}}` — Critical phases list
- `{{STACK}}` — Technology stack

## Documentation

- [Getting Started](docs/GETTING-STARTED.md)
- [Templates Guide](docs/TEMPLATES.md)
- [Customization](docs/CUSTOMIZATION.md)
- [Contributing](docs/CONTRIBUTING.md)

## License

MIT License — See [LICENSE](LICENSE) for details.

## Author

**Ilvan Joaquim** — Full Stack Developer
- GitHub: [@ilvanjoaquim](https://github.com/ilvanjoaquim)
- Website: [ilvanjoaquim.dev](https://ilvanjoaquim.dev)
