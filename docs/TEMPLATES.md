# behaviorOS Templates

> Pre-configured templates for different project types

## Available Templates

| Template | Description | Critical Phases | Use Case |
|----------|-------------|-----------------|----------|
| `saas-b2b` | B2B SaaS application | F2, F3 | Business software, dashboards, CRM |
| `saas-b2c` | B2C SaaS application | F2, F3 | Consumer apps, social platforms |
| `fintech` | Financial technology | F2, F3, F5, F6 | Payments, banking, compliance |
| `ecommerce` | E-commerce platform | F3, F4 | Online stores, retail |
| `marketplace` | Multi-sided marketplace | F3, F4 | Two-sided platforms, aggregators |
| `healthcare` | Healthcare application | F2, F3, F5 | Medical, health tech, telemedicine |
| `education` | Education platform | F2, F3 | LMS, courses, learning |
| `custom` | Custom template | Configurable | Start from scratch |

## Template Structure

Each template contains:

```
template-name/
├── blueprint/                    # Project blueprint
│   └── README.md                # Project documentation
└── governance/                   # Governance configuration
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

## Template Details

### saas-b2b

**Best for:** Business software, dashboards, CRM, ERP

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth

**Agents:**
- orchestrator, architect, backend, frontend, qa

**Critical Phases:**
- F2: Core Feature
- F3: Billing

### saas-b2c

**Best for:** Consumer apps, social platforms, productivity tools

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth

**Agents:**
- orchestrator, architect, backend, frontend, qa

**Critical Phases:**
- F2: Core Feature
- F3: Monetization

### fintech

**Best for:** Payments, banking, compliance-heavy applications

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth
- Queue: BullMQ + Redis

**Agents:**
- orchestrator, architect, backend, frontend, qa, compliance, security

**Critical Phases:**
- F2: Payments
- F3: Billing
- F5: Audit + Compliance
- F6: Launch

**Special Features:**
- AGT/SAF-T compliance
- LGPD data protection
- PCI-DSS security
- Audit trail

### ecommerce

**Best for:** Online stores, retail platforms

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth

**Agents:**
- orchestrator, architect, backend, frontend, qa, payments

**Critical Phases:**
- F3: Payments
- F4: Launch

### marketplace

**Best for:** Two-sided platforms, aggregators

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth

**Agents:**
- orchestrator, architect, backend, frontend, qa, payments

**Critical Phases:**
- F3: Payments
- F4: Launch

### healthcare

**Best for:** Medical, health tech, telemedicine

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth

**Agents:**
- orchestrator, architect, backend, frontend, qa, compliance, security

**Critical Phases:**
- F2: Core Feature
- F3: Patient Data
- F5: Compliance

**Special Features:**
- HIPAA compliance
- Patient data protection
- Audit trail

### education

**Best for:** LMS, courses, learning platforms

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth

**Agents:**
- orchestrator, architect, backend, frontend, qa

**Critical Phases:**
- F2: Core Feature
- F3: Content

## Using Templates

### Interactive Setup

```bash
node scripts/init.mjs
# Select template from menu
```

### Command Line

```bash
# Install specific template
node scripts/install.mjs --template=fintech

# With environment variables
PROJECT_NAME=my-app PROJECT_DESCRIPTION="My app" node scripts/install.mjs --template=saas-b2b
```

### Programmatic

```javascript
import { installFromTemplate } from './core/installer.mjs';

const result = installFromTemplate({
  template: 'fintech',
  projectName: 'my-fintech',
  projectDescription: 'A fintech application',
  criticalPhases: ['F2', 'F3', 'F5', 'F6'],
  targetDir: '/path/to/project',
});

console.log(result);
```

## Custom Templates

### Creating a Custom Template

1. Copy an existing template
2. Modify the configuration files
3. Update `INSTRUCTIONS.md` with your rules
4. Adjust `permissions-matrix.json` for your phases
5. Add custom skills if needed

### Template Variables

Templates support these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{PROJECT_NAME}}` | Project name | `my-app` |
| `{{PROJECT_DESCRIPTION}}` | Project description | `A SaaS application` |
| `{{CRITICAL_PHASES}}` | Critical phases | `["F2", "F3"]` |

## Template Comparison

| Feature | saas-b2b | saas-b2c | fintech | ecommerce | marketplace | healthcare | education |
|---------|----------|----------|---------|-----------|-------------|------------|-----------|
| Basic Auth | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| RBAC | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-tenant | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Compliance | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Audit Trail | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Payments | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |

## Next Steps

- [Getting Started](GETTING-STARTED.md)
- [Customization](CUSTOMIZATION.md)
- [API Reference](API.md)
