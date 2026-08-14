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
  "autonomyLevels": {
    "L1": {
      "name": "Rotina",
      "examples": [
        "Your custom L1 action",
        "Another L1 action"
      ]
    },
    "L2": {
      "name": "Auto-Expandir",
      "examples": [
        "Your custom L2 action"
      ]
    },
    "L3": {
      "name": "Escalar",
      "examples": [
        "Your custom L3 action"
      ]
    }
  },
  "rules": {
    "criticalPhases": [
      {
        "phase": "F2",
        "name": "Your Critical Phase",
        "requiresApproval": true
      }
    ]
  }
}
```

### 3. Skill Gate (skill-gate.json)

Controls which skills are required for each phase.

**Location:** `.opencode/governance/skill-gate.json`

**How to customize:**

```json
{
  "requiredSkills": {
    "F0": ["turborepo", "senior-fullstack"],
    "F1": ["your-skill", "another-skill"],
    "F2": ["nestjs", "prisma", "your-custom-skill"]
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
      "gate": "custom",
      "checks": [
        {
          "name": "custom-check",
          "command": "your-command",
          "required": true
        }
      ],
      "action": "block",
      "message": "Custom message"
    }
  ]
}
```

### 5. State Machine (state-machine.json)

Controls orchestrator lifecycle and phases.

**Location:** `.opencode/governance/state-machine.json`

**How to customize:**

```json
{
  "phaseStates": {
    "F0": {"status": "pending", "critical": false, "dependencies": []},
    "F1": {"status": "pending", "critical": false, "dependencies": ["F0"]},
    "F2": {"status": "pending", "critical": true, "dependencies": ["F1"]},
    "F3": {"status": "pending", "critical": true, "dependencies": ["F1"]},
    "F-CUSTOM": {"status": "pending", "critical": false, "dependencies": ["F2"]}
  }
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
      "pattern": "your-pattern",
      "action": "deny",
      "severity": "high"
    }
  ]
}
```

## Creating Custom Templates

### Step 1: Copy Existing Template

```bash
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
  "requiredSkills": {
    "F2": ["my-skill", "other-skill"]
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
  "agentPermissions": {
    "my-agent": {
      "canRead": true,
      "canWrite": true,
      "canExecute": false,
      "maxAutonomyLevel": 2,
      "allowedSkills": ["my-skill"]
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
