# AGENTS.md — {{PROJECT_NAME}}

## Identity
You are an AI agent working on **{{PROJECT_NAME}}**, a {{DOMAIN}} application governed by the behaviorOS framework.

## Project Context
* Name: {{PROJECT_NAME}}
* Domain: {{DOMAIN}}
* Stack: {{STACK}}
* Governance: behaviorOS ({{PHASES}} phases)

---

## COGNITIVE FLOW - BEFORE ANY TASK

**Follow this flow before writing code.** How strictly each step is enforced depends on risk (see "Risk Levels" below) — LOAD/GROUND/VALIDATE are runtime-blocked for HIGH/CRITICAL work, the rest are always good practice but not a universal hard gate on every write:

```
1. UNDERSTAND   → Read INSTRUCTIONS.md, package.json, blueprint
2. DISCOVER     → Glob/grep for related files, patterns, dependencies
3. IDENTIFY     → Detect technologies from file paths and content
4. LOAD         → Load relevant skills via skill tool
5. GROUND       → Anchor decisions in concrete evidence
6. VERIFY       → Check conventions, compatibility
7. PLAN         → Create implementation plan
8. EXECUTE      → Write code following the plan
9. VALIDATE     → Run lint, typecheck, test
10. AUDIT       → Check for anti-patterns, security
11. LEARN       → Record decisions, patterns
```

---

## Behavior Resolution Architecture

### Risk Levels
- **LOW**: read, lint, edit-readme, edit-docs → no enforcement
- **MEDIUM**: edit-component, edit-config, edit-test → no enforcement
- **HIGH**: edit-service, edit-schema, edit-module → require context7 + skills
- **CRITICAL**: edit-auth, edit-payment, edit-migration → require context7 + skills + truth

### Enforcement by Risk
| Risk | Context7 | Truth | Skill |
|------|----------|-------|-------|
| LOW | off | off | off |
| MEDIUM | off | off | off |
| HIGH | require(30min) | require(80%) | require(tech) |
| CRITICAL | require(60min) | require(95%) | require(tech) |

### Grounding Evidence
The audit plugin records evidence for:
- `package.json` reads → repo-state (confidence: 100)
- `context7` queries → official-docs (confidence: 90)
- `skill` loads → domain-knowledge (confidence: 85)
- `governance` reads → governance-context (confidence: 85)
- `bash` quality checks → quality-verification (confidence: 85)

---

## Agent Roles

| Agent | Responsibility | Allowed Phases |
|-------|---------------|----------------|
| orchestrator | Coordinates all phases, delegates tasks | All |
| architect | Architecture decisions, design reviews | {{PHASES}} |
| planner | Task breakdown, sprint planning | {{PHASES}} |
| backend | APIs, business logic, integrations | {{PHASES}} |
| frontend | UI components, user experience | {{PHASES}} |
| database | Schema, migrations, queries | {{PHASES}} |
| qa | Testing, quality assurance | {{PHASES}} |
| security | Security audits, vulnerability checks | {{PHASES}} |
| devops | CI/CD, deployment, infrastructure | {{PHASES}} |
| compliance | Regulatory compliance, audit trails | {{PHASES}} |

## Autonomy Levels
* **L1 (Routine):** CRUD, tests, lint, typecheck. No approval needed.
* **L2 (Auto-Expand):** Auxiliary fields, services, refactoring. Audit trail required.
* **L3 (Escalate):** New dependencies, schema changes, compliance. Requires human approval.

## Critical Phases
The following phases require human approval before proceeding:
* {{CRITICAL_PHASES}}

## Immutable Principles
1. Tests from the start (80% coverage minimum)
2. Contracts-first (oRPC/Zod before implementation)
3. Tenant isolation (organizationId in every query)
4. Design tokens (never raw hex)
5. Quality gates (lint -> typecheck -> build -> test)
6. Audit trail (all mutations logged)
7. {{DOMAIN_RULES}}

---

## Pipeline Commands

```powershell
# Run full pipeline
.\scripts\agent-loop.ps1 -Resume

# Run specific phase
.\scripts\agent-loop.ps1 -Phase F0

# Reset all to F0
.\scripts\agent-loop.ps1 -Reset "all"

# Check permissions
.\scripts\guards\permission-guard.ps1 -Agent backend -Phase F1

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
