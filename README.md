# behaviorOS

> Autonomous Development Governance System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/behaviorOS/behaviorOS)

behaviorOS is a governance system for autonomous software development. It enables AI agents to work independently while maintaining control through configurable gates, permissions, and audit trails.

## Features

- **Three-level autonomy model** — L1 (Routine), L2 (Auto-Expand), L3 (Escalate)
- **Skill gates** — Validates skills before task execution
- **Tool gates** — Validates tools before usage
- **Permission matrix** — Defines what agents can do
- **State machine** — Manages orchestrator lifecycle
- **Memory** — Maintains context between phases
- **Audit trail** — Records all actions
- **Compliance** — Supports regulatory requirements (AGT, SAF-T, LGPD, PCI-DSS)

## Quick Start

### Install

```bash
# Via OpenCode
opencode skill add behaviorOS

# Or manually
git clone https://github.com/behaviorOS/behaviorOS.git
```

### Initialize

```bash
# Interactive setup
/behaviorOS init

# From template
/behaviorOS install --template saas-b2b

# From blueprint
/behaviorOS install --blueprint ./blueprint/
```

### Start Development

```bash
/agent_loop --phase F0
```

## Templates

| Template | Description | Critical Phases |
|----------|-------------|-----------------|
| `saas-b2b` | B2B SaaS application | F2, F3 |
| `saas-b2c` | B2C SaaS application | F2, F3 |
| `fintech` | Financial technology | F2, F3, F5, F6 |
| `ecommerce` | E-commerce platform | F3, F4 |
| `marketplace` | Multi-sided marketplace | F3, F4 |
| `healthcare` | Healthcare application | F2, F3, F5 |
| `education` | Education platform | F2, F3 |
| `custom` | Custom template | Configurable |

## How It Works

### 1. Human Approves Scope
```
Human: "Build a SaaS for gym management"
```

### 2. behaviorOS Sets Up Governance
```
/behaviorOS init
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
│  Architect │ Backend │ Frontend │ QA │ Security     │
└─────────────────────────────────────────────────────┘
```

## Documentation

- [Getting Started](docs/GETTING-STARTED.md)
- [Templates Guide](docs/TEMPLATES.md)
- [Customization](docs/CUSTOMIZATION.md)
- [API Reference](docs/API.md)
- [Contributing](docs/CONTRIBUTING.md)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](docs/CONTRIBUTING.md) first.

## License

MIT License — See [LICENSE](LICENSE) for details.

## Author

**Ilvan Joaquim** — Full Stack Developer
- GitHub: [@ilvanjoaquim](https://github.com/ilvanjoaquim)
- Website: [ilvanjoaquim.dev](https://ilvanjoaquim.dev)

## Acknowledgments

- Built with [OpenCode](https://opencode.ai)
- Inspired by real-world autonomous development needs
