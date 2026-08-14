# behaviorOS

> Autonomous Development Governance System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/ilvan-develop/behaviorOS-skill)

behaviorOS is a governance system for autonomous software development. It enables AI agents to work independently while maintaining control through configurable gates, permissions, and audit trails.

## Features

- **Three-level autonomy model** — L1 (Routine), L2 (Auto-Expand), L3 (Escalate)
- **10 specialized agents** — orchestrator, architect, planner, backend, frontend, database, qa, security, devops, compliance
- **Skill gates** — Validates skills before task execution
- **Tool gates** — Validates tools before usage
- **Permission matrix** — Defines what agents can do
- **State machine** — Manages orchestrator lifecycle
- **Memory** — Maintains context between phases
- **Audit trail** — Records all actions
- **Compliance** — Supports regulatory requirements (AGT, SAF-T, LGPD, PCI-DSS, HIPAA)
- **8 pre-configured templates** — fintech, saas-b2b, saas-b2c, ecommerce, marketplace, healthcare, education, custom

## Quick Start

### Install

```bash
# Via OpenCode
opencode skill add behaviorOS-skill

# Or manually
git clone https://github.com/ilvan-develop/behaviorOS-skill.git
```

### Initialize

```bash
# Interactive setup
node scripts/init.mjs

# From template
node scripts/install.mjs --template=fintech

# With environment variables
PROJECT_NAME=my-app PROJECT_DESCRIPTION="My app" node scripts/install.mjs --template=saas-b2b
```

### Start Development

```bash
/agent_loop --phase F0
```

## Templates

| Template | Description | Critical Phases | Use Case |
|----------|-------------|-----------------|----------|
| `fintech` | Financial technology | F2, F3, F5, F6 | Payments, banking, compliance |
| `saas-b2b` | B2B SaaS application | F2, F3 | Business software, dashboards, CRM |
| `saas-b2c` | B2C SaaS application | F2, F3 | Consumer apps, social platforms |
| `ecommerce` | E-commerce platform | F3, F4 | Online stores, retail |
| `marketplace` | Multi-sided marketplace | F4, F5 | Two-sided platforms, aggregators |
| `healthcare` | Healthcare application | F3, F4, F5 | Medical, health tech, telemedicine |
| `education` | Education platform | F3, F4 | LMS, courses, learning |
| `custom` | Custom template | Configurable | Start from scratch |

## What's Included

### Agents

Each template includes 10 specialized agents:

| Agent | Responsibility | Skills |
|-------|----------------|--------|
| **Orchestrator** | Coordinates all phases | enterprise-architecture, senior-fullstack, turborepo |
| **Architect** | Architecture decisions | enterprise-architecture, senior-fullstack |
| **Planner** | Task planning | enterprise-product, turborepo |
| **Backend** | APIs and logic | nestjs, prisma, orpc |
| **Frontend** | UI and components | nextjs, react, tailwind, shadcn |
| **Database** | Schema and migrations | prisma, enterprise-database |
| **QA** | Testing and quality | vitest, playwright, testing-library |
| **Security** | Security and compliance | enterprise-security, helmet, compliance |
| **DevOps** | CI/CD and deploy | enterprise-devops, turborepo |
| **Compliance** | Regulatory compliance | compliance, agt, saf-t |

### Immutable Rules

Each template includes immutable rules that all agents must follow:

1. **Testes desde o princípio** — 80% coverage minimum
2. **Contracts-first** — API contracts before implementation
3. **Quality gates** — lint → typecheck → build → test
4. **Audit trail** — All mutations logged
5. **Compliance** — LGPD, PCI-DSS, HIPAA as needed
6. **Research first** — Always check documentation
7. **Fast execution** — Use fastest path available

### Governance Files

Each template includes 10 governance files:

```
template-name/
├── blueprint/
│   └── README.md
└── governance/
    ├── opencode.json            # Central configuration
    ├── INSTRUCTIONS.md          # Absolute rules
    ├── permissions-matrix.json  # Permission matrix
    ├── skill-gate.json          # Skill validation
    ├── tool-gate.json           # Tool validation
    ├── state-machine.json       # Orchestrator lifecycle
    ├── memory.json              # Memory configuration
    ├── audit.json               # Audit configuration
    ├── security-gates.json      # Security validations
    └── production-gate.json     # Production readiness
```

## How It Works

### 1. Human Approves Scope
```
Human: "Build a SaaS for gym management"
```

### 2. behaviorOS Sets Up Governance
```
node scripts/install.mjs --template=saas-b2b
→ Generates governance configuration
→ Sets up skill gates, tool gates
→ Creates memory structure
→ Initializes audit trail
```

### 3. Orchestrator Works Autonomously
```
/agent_loop --phase F0
→ Plans tasks
→ Delegates to agents
→ Validates with gates
→ Executes
→ Audits
→ Updates memory
```

### 4. Human Reviews When Needed
```
Orchestrator: "Phase F2 complete. Requires approval for F3."
Human: "Approved"
/agent_loop --phase F3
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   HUMAN                             │
│            (Approves Scope)                         │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│              behaviorOS GOVERNANCE                   │
│                                                     │
│  ┌─────────────┬─────────────┬─────────────┐       │
│  │ Skill Gate  │ Tool Gate   │ Permission  │       │
│  └─────────────┴─────────────┴─────────────┘       │
│  ┌─────────────┬─────────────┬─────────────┐       │
│  │ State       │ Memory      │ Audit       │       │
│  │ Machine     │             │ Trail       │       │
│  └─────────────┴─────────────┴─────────────┘       │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│              AGENTS                                 │
│  Orchestrator │ Architect │ Planner │ Backend       │
│  Frontend │ Database │ QA │ Security │ DevOps       │
│  Compliance                                              │
└─────────────────────────────────────────────────────┘
```

## Validation

behaviorOS includes a validator to ensure configuration is correct:

```bash
# Validate all templates
node scripts/validate.mjs

# Validate specific template
node scripts/validate.mjs --template=fintech
```

## Documentation

- [Getting Started](docs/GETTING-STARTED.md)
- [Templates Guide](docs/TEMPLATES.md)
- [Customization](docs/CUSTOMIZATION.md)
- [Quick Start](docs/QUICKSTART.md)
- [Contributing](docs/CONTRIBUTING.md)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](docs/CONTRIBUTING.md) first.

## License

MIT License — See [LICENSE](LICENSE) for details.

## Author

**Ilvan Joaquim** — Full Stack Developer
- GitHub: [@ilvanjoaquim](https://github.com/ilvanjoaquim)

## Acknowledgments

- Built with [OpenCode](https://opencode.ai)
- Inspired by real-world autonomous development needs
