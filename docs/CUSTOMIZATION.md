# behaviorOS Customization

> Guide to customize behaviorOS for your specific needs

## Overview

behaviorOS is designed to be highly customizable. This guide covers how to modify governance rules, templates, and behavior to fit your project.

## Customization Areas

### 1. Rules (INSTRUCTIONS.md)

The `INSTRUCTIONS.md` file contains absolute rules that all agents must follow.

**Location:** `.opencode/governance/INSTRUCTIONS.md`

**How to customize:**

```markdown
# behaviorOS — Instruções Absolutas

## Regras Imutáveis

### 1. Your Custom Rule
- Description of your rule
- Why it's important
- How to follow it

### 2. Another Rule
- ...
```

**Example:**

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

### 2. Permission Matrix (permissions-matrix.json)

Controls autonomy levels and permissions.

**Location:** `.opencode/governance/permissions-matrix.json`

**How to customize:**

```json
{
  "matrix": {
    "F0": {
      "name": "Fundação",
      "isCritical": false,
      "requiredApprovals": 0,
      "allowedAgents": ["orchestrator", "architect", "devops"]
    },
    "F1": {
      "name": "Core Feature",
      "isCritical": true,
      "requiredApprovals": 1,
      "allowedAgents": ["orchestrator", "architect", "backend", "frontend", "database", "qa", "security"]
    }
  }
}
```

### 3. Skill Gate (skill-gate.json)

Controls which skills are required for each phase.

**Location:** `.opencode/governance/skill-gate.json`

**How to customize:**

```json
{
  "phases": {
    "F0": {
      "required": ["enterprise-architecture", "senior-fullstack", "turborepo"],
      "optional": ["enterprise-devops"]
    },
    "F1": {
      "required": ["nestjs", "prisma", "orpc", "your-custom-skill"],
      "optional": ["vitest", "playwright"]
    }
  }
}
```

### 4. Tool Gate (tool-gate.json)

Controls tool validations.

**Location:** `.opencode/governance/tool-gate.json`

**How to customize:**

```json
{
  "rules": [
    {
      "id": "custom-rule",
      "tool": "bash",
      "pattern": "your-pattern*",
      "action": "ask",
      "reason": "Custom reason",
      "checks": ["lint", "typecheck", "test"]
    }
  ],
  "globalRules": {
    "forbidden": ["password", "secret", "token", "key"],
    "required": ["organizationId"]
  }
}
```

### 5. State Machine (state-machine.json)

Controls orchestrator lifecycle and phases.

**Location:** `.opencode/governance/state-machine.json`

**How to customize:**

```json
{
  "states": [
    {
      "id": "F0",
      "name": "Fundação",
      "description": "Setup do projeto",
      "status": "pending",
      "isCritical": false
    },
    {
      "id": "F1",
      "name": "Core Feature",
      "description": "Feature principal",
      "status": "pending",
      "isCritical": true
    },
    {
      "id": "F-CUSTOM",
      "name": "Custom Phase",
      "description": "Your custom phase",
      "status": "pending",
      "isCritical": false
    }
  ],
  "transitions": [
    { "from": "F0", "to": "F1", "condition": "all-gates-pass" },
    { "from": "F1", "to": "F-CUSTOM", "condition": "all-gates-pass" }
  ]
}
```

### 6. Security Gates (security-gates.json)

Controls security validations.

**Location:** `.opencode/governance/security-gates.json`

**How to customize:**

```json
{
  "rules": [
    {
      "id": "custom-security-rule",
      "name": "Custom Security Rule",
      "description": "Description of the rule",
      "pattern": "your-pattern",
      "action": "deny",
      "severity": "critical"
    }
  ]
}
```

### 7. Audit Configuration (audit.json)

Controls audit logging.

**Location:** `.opencode/governance/audit.json`

**How to customize:**

```json
{
  "enabled": true,
  "destination": ".opencode/audit/audit.log",
  "retention": {
    "days": 180,
    "compression": true
  },
  "capture": {
    "fileChanges": true,
    "toolCalls": true,
    "gates": true,
    "escalations": true,
    "scopeChanges": true,
    "agentDeclarations": true,
    "dataAccess": true
  },
  "alerts": {
    "onBlock": true,
    "onEscalation": true,
    "onError": true,
    "onDataAccess": true
  }
}
```

### 8. Memory Configuration (memory.json)

Controls memory sections.

**Location:** `.opencode/governance/memory.json`

**How to customize:**

```json
{
  "destination": ".opencode/memory/",
  "sections": [
    {
      "id": "decisions",
      "name": "decisions.md",
      "description": "Decisões arquiteturais"
    },
    {
      "id": "patterns",
      "name": "patterns.md",
      "description": "Padrões descobertos"
    },
    {
      "id": "learnings",
      "name": "learnings.md",
      "description": "Lições aprendidas"
    },
    {
      "id": "currentPhase",
      "name": "current-phase.md",
      "description": "Estado da fase atual"
    },
    {
      "id": "compliance",
      "name": "compliance.md",
      "description": "Registros de compliance"
    }
  ],
  "autoUpdate": true,
  "updateTrigger": "phase-complete"
}
```

### 9. Production Gate (production-gate.json)

Controls production readiness checks.

**Location:** `.opencode/governance/production-gate.json`

**How to customize:**

```json
{
  "phase": "F5",
  "checks": [
    {
      "id": "all-phases-complete",
      "name": "Todas as fases anteriores completas",
      "required": true
    },
    {
      "id": "test-coverage",
      "name": "Cobertura de testes ≥ 80%",
      "required": true,
      "threshold": 80
    },
    {
      "id": "security-audit",
      "name": "Auditoria de segurança",
      "required": true
    },
    {
      "id": "compliance-check",
      "name": "Verificação de compliance",
      "required": true
    }
  ]
}
```

### 10. Agents Configuration (opencode.json)

Controls agents and their skills.

**Location:** `.opencode/governance/opencode.json`

**How to customize:**

```json
{
  "agents": {
    "orchestrator": {
      "description": "Coordenador autônomo de todas as fases",
      "maxAutonomyLevel": 2,
      "canParallelize": true,
      "skills": ["enterprise-architecture", "senior-fullstack", "turborepo"]
    },
    "architect": {
      "description": "Arquitetura e decisões de design",
      "skills": ["enterprise-architecture", "senior-fullstack"]
    },
    "my-agent": {
      "description": "My custom agent",
      "skills": ["my-skill", "other-skill"]
    }
  }
}
```

## Creating Custom Templates

### Step 1: Copy Existing Template

```bash
# Windows
xcopy /E /I templates\saa s-b2b templates\my-custom

# Linux/Mac
cp -r templates/saas-b2b templates/my-custom
```

### Step 2: Modify Configuration Files

Update each file in `templates/my-custom/governance/`:

1. `opencode.json` — Agents and permissions
2. `INSTRUCTIONS.md` — Custom rules
3. `permissions-matrix.json` — Autonomy levels
4. `skill-gate.json` — Required skills
5. `tool-gate.json` — Tool validations
6. `state-machine.json` — Phases
7. `memory.json` — Memory sections
8. `audit.json` — Audit configuration
9. `security-gates.json` — Security rules
10. `production-gate.json` — Production checks

### Step 3: Update Template Metadata

Edit `templates/my-custom/governance/opencode.json`:

```json
{
  "project": "{{PROJECT_NAME}}",
  "description": "{{PROJECT_DESCRIPTION}}",
  "governance": {
    "criticalPhases": ["F2", "F3", "F-CUSTOM"]
  }
}
```

### Step 4: Test Your Template

```bash
node scripts/install.mjs --template=my-custom
node scripts/validate.mjs
```

## Custom Skills

### Adding a New Skill

1. Create skill directory:
```bash
mkdir -p .opencode/skills/my-skill
```

2. Create `SKILL.md`:
```markdown
---
name: my-skill
description: My custom skill
metadata:
  scope: custom
  version: "1.0.0"
---

# My Skill

## Overview
Description of your skill.

## When to Use
- Use case 1
- Use case 2

## Implementation
Code examples and patterns.
```

3. Reference in `skill-gate.json`:
```json
{
  "phases": {
    "F2": {
      "required": ["my-skill", "other-skill"],
      "optional": []
    }
  }
}
```

## Custom Agents

### Adding a New Agent

1. Add agent to `opencode.json`:
```json
{
  "agents": {
    "my-agent": {
      "description": "My custom agent",
      "skills": ["my-skill", "other-skill"]
    }
  }
}
```

2. Add permissions to `permissions-matrix.json`:
```json
{
  "matrix": {
    "F1": {
      "allowedAgents": ["orchestrator", "architect", "my-agent"]
    }
  }
}
```

## Environment Variables

### Project Configuration

Set these environment variables before running installer:

```bash
export PROJECT_NAME="my-app"
export PROJECT_DESCRIPTION="My application"
```

### Custom Variables

Add custom variables to your templates:

```markdown
# In INSTRUCTIONS.md
{{CUSTOM_VARIABLE}}
```

```bash
# Set before installation
export CUSTOM_VARIABLE="my-value"
```

## Immutable Rules Examples

### Fintech Rules
1. Testes desde o princípio (80% cobertura)
2. Contracts-first
3. Tenant isolation
4. Design tokens
5. Quality gates
6. Audit trail
7. Money movement nativo
8. Conformidade AGT/SAF-T
9. Pesquisar antes de implementar
10. Execução rápida por defeito

### Healthcare Rules
1. Testes desde o princípio (80% cobertura)
2. Contracts-first
3. Tenant isolation
4. Quality gates
5. Audit trail
6. LGPD
7. Criptografia de dados sensíveis
8. Pesquisar antes de implementar
9. Execução rápida por defeito

### E-commerce Rules
1. Testes desde o princípio (80% cobertura)
2. Contracts-first
3. Tenant isolation
4. Quality gates
5. Audit trail
6. PCI-DSS
7. LGPD
8. Pesquisar antes de implementar
9. Execução rápida por defeito

## Best Practices

### 1. Start Simple
- Begin with a base template
- Add customizations incrementally
- Test after each change

### 2. Document Changes
- Update INSTRUCTIONS.md with new rules
- Add comments in configuration files
- Keep a changelog

### 3. Version Control
- Commit governance files
- Use meaningful commit messages
- Tag versions

### 4. Test Thoroughly
- Run validator after changes
- Test with sample project
- Verify all gates work

## Troubleshooting

### "Invalid configuration" error

Run validator to identify issues:
```bash
node scripts/validate.mjs
```

### Template not found

Ensure template directory exists:
```bash
ls templates/
```

### JSON parse error

Check JSON syntax:
```bash
cat .opencode/governance/opencode.json | jq .
```

## Next Steps

- [Getting Started](GETTING-STARTED.md)
- [Templates Guide](TEMPLATES.md)
- [API Reference](API.md)
