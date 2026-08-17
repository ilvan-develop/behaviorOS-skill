# behaviorOS

> Autonomous Development Governance System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/ilvan-develop/behaviorOS-skill)

behaviorOS is a governance system for autonomous software development. It enables AI agents to work independently while maintaining control through configurable gates, permissions, and audit trails.

## The enforcement invariant

> A policy file is not an enforcement mechanism. A policy is enforced only when its declared
> authority, consumer, failure mode and adversarial test are all verifiably connected.

Every policy declares who may apply it in [`governance-contract.json`](templates/base/governance/governance-contract.json), and `npm run doctor` checks that declaration against the code — blocking on a policy declared "enforced" that nothing reads, on a consumer that no longer references its policy, and on a runtime claim no plugin backs.

This exists because the opposite was true and invisible: the suite was green, `validate` reported 24/24, and the README promised guarantees that matched no code path. Each claim below therefore names **where** it is enforced, because "runtime", "at a phase boundary" and "in CI" are different promises.

## Features

- **Three-level autonomy model** — L1 (Routine), L2 (Auto-Expand), L3 (Escalate)
- **10 specialized agents** — orchestrator, architect, planner, backend, frontend, database, qa, security, devops, compliance
- **Skill gates** — Validates skills before task execution. Enforced at runtime from `policy-resolver.json`; `skill-gate.json` governs the phase-level pipeline
- **Tool gates** — Validates tools before usage (runtime)
- **Permission matrix** — Declares which agents may act in which phase. Enforced **at handoff / phase boundaries**, not at runtime: `tool.execute.before` carries no agent identity, so a runtime check would be a false sense of enforcement
- **State machine** — Manages orchestrator lifecycle (runtime; read fresh on every call, never cached)
- **Memory** — Maintains context between phases
- **Audit trail** — Records all actions automatically via runtime plugins, not just on request
- **10 runtime-enforced gates** — `.opencode/plugins/oage-enforce.js` blocks on every `tool.execute.before` call: protected resources, anti-patterns, dependency gate, truth gate, loop detection, skill tracking, context7 check, quality gates, agent loop flow, version pinning
- **Automatic audit trail** — `.opencode/plugins/oage-audit.js` logs every tool call AND detects gate-specific events (context7 queries, skill loads, version checks, quality checks)
- **Anti-pattern library** — 29 regex + manual anti-patterns across architecture/database/api/security/testing/git/monorepo/typescript/react/nextjs/ci-cd/ux/ai-agents
- **Truth gate** — critical files (schemas, migrations, payments, auth) require a declared confidence >= threshold before write
- **Independent reviewer gate** — critical phases cannot be marked complete without review by a different agent than the implementer (phase boundary, via `scripts/reviewer-check.mjs --phase`)
- **Evidence-based completion** — phases require a recorded evidence file (tests, build, lint results) before "completed" (phase boundary, via `scripts/evidence-check.mjs --phase`)
- **Governance contract** — every policy declares its authority, consumer, failure mode and adversarial test; `npm run doctor` blocks when a declaration and the code disagree
- **Structured handoffs** — `scripts/handoff.mjs` generates FROM/TO/CONTEXT/NEXT_ACTION docs between agents
- **CI as final authority** — installable `.github/workflows/oage-ci.yml` re-validates policy, secrets, and quality gates independent of what an agent claims
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

Each template includes its own governance files, plus a set of cross-cutting OAGE files
shared by every template (`templates/base/governance/`) that `core/generator.mjs` copies
into every install automatically:

```
template-name/
├── blueprint/
│   └── README.md
└── governance/
    ├── opencode.json            # Central configuration (schema-valid, no governance key)
    ├── INSTRUCTIONS.md          # Absolute rules (+ OAGE rules 20-27 appended at install)
    ├── permissions-matrix.json  # Permission matrix
    ├── skill-gate.json          # Skill validation (phase-based)
    ├── skill-gate-auto.json     # Skill validation (file-extension-based, used by plugin)
    ├── tool-gate.json           # Tool validation
    ├── state-machine.json       # Orchestrator lifecycle
    ├── memory.json              # Memory configuration
    ├── audit.json               # Audit configuration
    ├── security-gates.json      # Security validations
    ├── production-gate.json     # Production readiness
    ├── anti-patterns.json       # shared — anti-pattern library (29 patterns)
    ├── protected-resources.json # shared — .env/secrets/keys deny-list
    ├── loop-detector.json       # shared — repeated-action thresholds
    ├── dependency-gate.json     # shared — dependency justification
    ├── truth-gate.json          # shared — confidence threshold for critical files
    ├── context7-gate.json       # shared — context7 requirement config
    ├── version-pinning-gate.json# shared — version pinning enforcement
    ├── reviewer-gate.json       # shared — independent review requirement
    ├── mcp-registry.json        # shared — registered MCP servers
    ├── handoff-schema.json      # shared — agent handoff schema
    ├── definition-of-done.json  # shared — evidence required to complete a phase
    └── ci-gate.json             # shared — required CI checks
```

Installs also receive `.opencode/plugins/` (the runtime enforcement plugins),
`.opencode/commands/` (`/oage-doctor`, `/oage-audit`, `/oage-review`, `/oage-research`,
`/oage-release`), and `.github/workflows/oage-ci.yml`.

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
- [Quick Start](docs/QUICKSTART.md)
- [Integration Guide](docs/INTEGRATION.md) — adding behaviorOS to an **existing** project
- [Templates Guide](docs/TEMPLATES.md)
- [Customization](docs/CUSTOMIZATION.md)
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
