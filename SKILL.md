---
name: behaviorOS
description: Autonomous development governance system with skill gates, tool gates, permissions, state machine, memory, audit trail, and compliance. Sets up governance for any software project with three-level autonomy model.
metadata:
  scope: governance
  version: "1.1.0"
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

## Mandatory Flow (Rules 11-19)

**Before ANY task, the AI agent MUST follow this sequence:**

```
1. context7_resolve-library-id  -> resolve library name
2. context7_query-docs           -> get current documentation
3. skill (tool)                  -> load relevant skill
4. Read skill anti-patterns     -> understand what NOT to do
5. implement                     -> write code using only documented APIs
6. enforce.ps1                   -> validate before tool call
7. update memory                 -> record decisions/patterns
```

### Key Rules
- **Rule 11**: Context7 is OBLIGATORY - never assume APIs from memory
- **Rule 12**: Load skill BEFORE code - read anti-patterns first
- **Rule 13**: Anti-patterns are prohibited - fix before commit
- **Rule 16**: Enforcement Layer is MANDATORY — runtime plugin enforces automatically (no manual script needed)
- **Rule 17**: Skill tracking is MANDATORY — auto-detected by `oage-audit.js` when `skill` tool is used
- **Rule 18**: Agent Loop is MANDATORY for ALL phases — plugin warns if context7 + skill sequence skipped
- **Rule 19**: Version pinning is MANDATORY — plugin warns if `package.json` not consulted
- **Rules 20-27**: Runtime-enforced on every `tool.execute.before` call — protected resources, anti-pattern
  scanning, loop detection, dependency justification, truth-gate confidence, independent
  review, structured handoffs, evidence-based completion. See `.opencode/governance/INSTRUCTIONS.md`
  and `.opencode/plugins/oage-enforce.js`.

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

### PowerShell Scripts (Primary)

| Command | Description |
|---------|-------------|
| `.\scripts\agent-loop.ps1` | Run full F0-F6 lifecycle |
| `.\scripts\agent-loop.ps1 -Phase F0` | Execute specific phase |
| `.\scripts\agent-loop.ps1 -Resume` | Resume from current state |
| `.\scripts\agent-loop.ps1 -Reset all` | Reset all phases to F0 |
| `.\scripts\agent-loop.ps1 -DryRun` | Simulate without changes |
| `.\scripts\enforce.ps1 -Tool "write" -File "..." -Agent "backend" -Phase "F1"` | Run enforcement before tool call |
| `.\scripts\state-manager.ps1 -Action get` | Get current state |
| `.\scripts\state-manager.ps1 -Action list` | List all phases |
| `.\scripts\skill-tracker.ps1 -Skill "prisma" -Agent "backend" -Phase "F1" -Action load` | Load a skill |

### Node.js Scripts

| Command | Description |
|---------|-------------|
| `node scripts/init.mjs` | Interactive setup wizard |
| `node scripts/install.mjs --template fintech` | Install from template |
| `node scripts/install.mjs --blueprint ./blueprint/` | Install from blueprint |
| `node scripts/validate.mjs` | Validate configuration |
| `node scripts/generate-blueprints.mjs` | Generate blueprint.json for all templates |

## What Gets Installed

```
your-project/
├── opencode.json                    # Central configuration (schema-valid, no governance key)
├── .github/workflows/
│   └── oage-ci.yml                  # CI as final authority (policy, secrets, lint, test, build)
└── .opencode/
    ├── governance/
    │   ├── INSTRUCTIONS.md          # Absolute rules (+ OAGE rules 20-27 appended)
    │   ├── permissions-matrix.json  # Permission matrix
    │   ├── skill-gate.json          # Skill validation (phase-based)
    │   ├── skill-gate-auto.json     # Skill validation (file-extension-based, plugin reads this)
    │   ├── tool-gate.json           # Tool validation
    │   ├── state-machine.json       # Orchestrator lifecycle
    │   ├── memory.json              # Memory configuration
    │   ├── audit.json               # Audit configuration
    │   ├── security-gates.json      # Security validations
    │   ├── production-gate.json     # Production readiness
    │   ├── anti-patterns.json       # Anti-pattern library (29 patterns, regex + manual)
    │   ├── protected-resources.json # .env/secrets/keys — never readable/writable
    │   ├── loop-detector.json       # Repeated-action / recovery thresholds
    │   ├── dependency-gate.json     # New-dependency justification requirement
    │   ├── truth-gate.json          # Confidence threshold for critical files
    │   ├── context7-gate.json       # Context7 requirement (enforced by plugin)
    │   ├── version-pinning-gate.json# Version pinning enforcement (enforced by plugin)
    │   ├── reviewer-gate.json       # Independent review required for critical phases
    │   ├── mcp-registry.json        # Registered MCP servers + risk
    │   ├── handoff-schema.json      # Structured agent-to-agent handoff schema
    │   ├── definition-of-done.json  # Evidence required before "completed"
    │   └── ci-gate.json             # Required CI checks
    ├── plugins/
    │   ├── oage-enforce.js         # tool.execute.before — 10 runtime-enforced gates
    │   ├── oage-audit.js           # tool.execute.after — audit trail + gate-specific events
    │   └── lib/oage-lib.js         # Shared utilities
    ├── commands/
    │   ├── oage-doctor.md           # /oage-doctor — health check
    │   ├── oage-audit.md            # /oage-audit — full governance audit
    │   ├── oage-review.md           # /oage-review — read-only diff review
    │   ├── oage-research.md         # /oage-research — context7-gated library research
    │   └── oage-release.md          # /oage-release — production checklist
    ├── memory/
    │   ├── decisions.md
    │   ├── patterns.md
    │   ├── learnings.md
    │   ├── current-phase.md
    │   └── scope-history.md
    └── skills/                      # Compliance skills
        ├── compliance/
        └── ...
```

### Runtime enforcement vs. advisory gates

The JSON files under `.opencode/governance/` are policy — they only take effect because
`.opencode/plugins/oage-enforce.js` reads them on every `tool.execute.before` call and
`.opencode/plugins/oage-audit.js` logs every call automatically. Without those two plugin
files, the gates are advisory only (an agent has to voluntarily call `enforce.ps1`, per Rule
16) — install them into any project you didn't generate through `install.mjs` if you want the
same protection.

### New CLI helpers

| Command | Purpose |
|---------|---------|
| `node scripts/audit-event.mjs --event <name> ...` | Log `confidence_declared` / `dependency_justification` / `review_approved` events required by the truth/dependency/reviewer gates |
| `node scripts/handoff.mjs --from <agent> --to <agent> ...` | Generate a structured handoff doc in `.opencode/handoffs/` |
| `node scripts/evidence-check.mjs --phase <F#>` | Validate `.opencode/evidence/{phase}.json` against `definition-of-done.json` |
| `node scripts/reviewer-check.mjs --phase <F#>` | Validate an independent review exists for a critical phase |
| `node scripts/oage-metrics.mjs` | Observability report (denial rate, loop detection rate, skill/context7 usage) |
| `node scripts/lint.mjs` | JSON validity + secret scan + critical anti-pattern scan |

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
