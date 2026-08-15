# AGENTS.md — {{PROJECT_NAME}}

## Identity
You are an AI agent working on **{{PROJECT_NAME}}**, a {{DOMAIN}} application governed by the behaviorOS framework.

## Project Context
* Name: {{PROJECT_NAME}}
* Domain: {{DOMAIN}}
* Stack: {{STACK}}
* Governance: behaviorOS ({{PHASES}} phases)

## Agent Roles

| Agent | Responsibility | Allowed Phases |
|-------|---------------|----------------|
| orchestrator | Coordinates all phases, delegates tasks | All |
| architect | Architecture decisions, design reviews | F0-F5 |
| planner | Task breakdown, sprint planning | F0-F6 |
| backend | APIs, business logic, integrations | F1-F6 |
| frontend | UI components, user experience | F2-F4, F6 |
| database | Schema, migrations, queries | F1-F5 |
| qa | Testing, quality assurance | F1-F6 |
| security | Security audits, vulnerability checks | F2-F3, F5-F6 |
| devops | CI/CD, deployment, infrastructure | F0, F4, F6 |
| compliance | Regulatory compliance, audit trails | F2-F3, F5 |

## Governance Rules

### Autonomy Levels
* L1 (Routine): CRUD, tests, lint, typecheck. No approval needed.
* L2 (Auto-Expand): Auxiliary fields, services, refactoring. Audit trail required.
* L3 (Escalate): New dependencies, schema changes, compliance. Requires human approval.

### Critical Phases
The following phases require human approval before proceeding:
* {{CRITICAL_PHASES}}

### Immutable Rules
* Tests from the start
* Contracts-first (oRPC/Zod)
* Tenant isolation
* Design tokens
* Quality gates
* Audit trail
* {{DOMAIN_RULES}}

## Pipeline Commands

```bash
# Run full pipeline
./scripts/run-pipeline.ps1 -Full

# Run specific phase
./scripts/run-pipeline.ps1 -Phase {{PHASE}} -Agent {{AGENT}}

# Check permissions
./scripts/guards/permission-guard.ps1 -Agent {{AGENT}} -Phase {{PHASE}}

# Check tools
./scripts/guards/tool-guard.ps1 -Tool {{TOOL}} -File {{FILE}}

# Check skills
./scripts/guards/skill-guard.ps1 -Skill {{SKILL}} -Agent {{AGENT}}

# Validate configuration
node scripts/validate.mjs
```

## Skills

### Required Skills (always loaded)
* context7-mcp
* enterprise-governance
* {{DOMAIN_SKILLS}}

### Agent-Specific Skills
See `opencode.json` for the full skill mapping per agent.

## Communication
* Use semantic commit prefixes: feat:, fix:, docs:, test:, refactor:
* Never push to main. Always use feature branches.
* Run lint and typecheck before committing.
* PRs: Start with "This PR..." and limit to 2-3 sentences.
* Avoid em dashes. Use commas or separate sentences.

## Memory
* Governance state: `.opencode/memory/current-phase.md`
* Decisions log: `.opencode/memory/decisions.md`
* Learnings: `.opencode/memory/learnings.md`
* Patterns: `.opencode/memory/patterns.md`

## Audit
* All actions are logged in `.opencode/audit/audit.jsonl`
* Skills loaded: `.opencode/audit/skills-loaded.json`
