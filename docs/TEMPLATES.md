# behaviorOS Templates

> Pre-configured templates for different project types

## Available Templates

| Template | Description | Critical Phases | Use Case |
|----------|-------------|-----------------|----------|
| `saas-b2b` | B2B SaaS application | F2, F3 | Business software, dashboards, CRM |
| `saas-b2c` | B2C SaaS application | F2, F3 | Consumer apps, social platforms |
| `fintech` | Financial technology | F2, F3, F5, F6 | Payments, banking, compliance |
| `ecommerce` | E-commerce platform | F3, F4 | Online stores, retail |
| `marketplace` | Multi-sided marketplace | F4, F5 | Two-sided platforms, aggregators |
| `healthcare` | Healthcare application | F3, F4, F5 | Medical, health tech, telemedicine |
| `education` | Education platform | F3, F4 | LMS, courses, learning |
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
- orchestrator, architect, planner, backend, frontend, database, qa, security, devops

**Skills:**
- enterprise-architecture, senior-fullstack, turborepo, nestjs, prisma, orpc, nextjs, react, tailwind, shadcn, vitest, playwright, enterprise-security, enterprise-devops

**Critical Phases:**
- F2: Core Feature
- F3: Billing

**Immutable Rules:**
1. Testes desde o princípio (80% cobertura)
2. Contracts-first
3. Quality gates
4. Audit trail
5. LGPD
6. Pesquisar antes de implementar
7. Execução rápida por defeito

### saas-b2c

**Best for:** Consumer apps, social platforms, productivity tools

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth

**Agents:**
- orchestrator, architect, planner, backend, frontend, database, qa, security, devops

**Skills:**
- enterprise-architecture, senior-fullstack, turborepo, nestjs, prisma, orpc, nextjs, react, tailwind, shadcn, vitest, playwright, enterprise-security, enterprise-devops

**Critical Phases:**
- F2: Core Feature
- F3: Billing

**Immutable Rules:**
1. Testes desde o princípio (80% cobertura)
2. Contracts-first
3. Quality gates
4. Audit trail
5. LGPD
6. Pesquisar antes de implementar
7. Execução rápida por defeito

### fintech

**Best for:** Payments, banking, compliance-heavy applications

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth
- Queue: BullMQ + Redis

**Agents:**
- orchestrator, architect, planner, backend, frontend, database, qa, security, devops, compliance

**Skills:**
- enterprise-architecture, senior-fullstack, turborepo, nestjs, prisma, orpc, better-auth, nextjs, react, tailwind, shadcn, vitest, playwright, enterprise-security, enterprise-devops, compliance, agt, saf-t

**Critical Phases:**
- F2: Payments
- F3: Billing
- F5: Audit + Compliance
- F6: Launch

**Immutable Rules:**
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

**Special Features:**
- AGT/SAF-T compliance
- LGPD data protection
- PCI-DSS security
- Audit trail
- Tenant isolation

### ecommerce

**Best for:** Online stores, retail platforms

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth
- Search: Elasticsearch

**Agents:**
- orchestrator, architect, planner, backend, frontend, database, qa, security, devops

**Skills:**
- enterprise-architecture, senior-fullstack, turborepo, nestjs, prisma, orpc, nextjs, react, tailwind, shadcn, vitest, playwright, enterprise-security, enterprise-devops

**Critical Phases:**
- F3: Cart + Checkout
- F4: Orders + Payment

**Immutable Rules:**
1. Testes desde o princípio (80% cobertura)
2. Contracts-first
3. Tenant isolation
4. Quality gates
5. Audit trail
6. PCI-DSS
7. LGPD
8. Pesquisar antes de implementar
9. Execução rápida por defeito

**Special Features:**
- PCI-DSS compliance
- LGPD data protection
- Multi-tenant support

### marketplace

**Best for:** Two-sided platforms, aggregators

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth
- Search: Elasticsearch

**Agents:**
- orchestrator, architect, planner, backend, frontend, database, qa, security, devops

**Skills:**
- enterprise-architecture, senior-fullstack, turborepo, nestjs, prisma, orpc, nextjs, react, tailwind, shadcn, vitest, playwright, enterprise-security, enterprise-devops

**Critical Phases:**
- F4: Orders + Payment
- F5: Hardening

**Immutable Rules:**
1. Testes desde o princípio (80% cobertura)
2. Contracts-first
3. Tenant isolation
4. Quality gates
5. Audit trail
6. PCI-DSS
7. LGPD
8. Pesquisar antes de implementar
9. Execução rápida por defeito

**Special Features:**
- PCI-DSS compliance
- LGPD data protection
- Multi-tenant mandatory

### healthcare

**Best for:** Medical, health tech, telemedicine

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth
- Encryption: AES-256, RSA

**Agents:**
- orchestrator, architect, planner, backend, frontend, database, qa, security, devops

**Skills:**
- enterprise-architecture, senior-fullstack, turborepo, nestjs, prisma, orpc, nextjs, react, tailwind, shadcn, vitest, playwright, enterprise-security, enterprise-devops

**Critical Phases:**
- F3: Medical Records
- F4: Appointments
- F5: Hardening

**Immutable Rules:**
1. Testes desde o princípio (80% cobertura)
2. Contracts-first
3. Tenant isolation
4. Quality gates
5. Audit trail
6. LGPD
7. Criptografia de dados sensíveis
8. Pesquisar antes de implementar
9. Execução rápida por defeito

**Special Features:**
- HIPAA compliance
- Patient data encryption
- LGPD data protection
- Audit trail with data access logging

### education

**Best for:** LMS, courses, learning platforms

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth

**Agents:**
- orchestrator, architect, planner, backend, frontend, database, qa, security, devops

**Skills:**
- enterprise-architecture, senior-fullstack, turborepo, nestjs, prisma, orpc, nextjs, react, tailwind, shadcn, vitest, playwright, enterprise-security, enterprise-devops

**Critical Phases:**
- F3: Content
- F4: Progress

**Immutable Rules:**
1. Testes desde o princípio (80% cobertura)
2. Contracts-first
3. Quality gates
4. Audit trail
5. LGPD
6. Acessibilidade (WCAG 2.1)
7. Pesquisar antes de implementar
8. Execução rápida por defeito

**Special Features:**
- WCAG 2.1 accessibility
- LGPD data protection

### custom

**Best for:** Start from scratch, unique requirements

**Stack:**
- Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui
- Backend: NestJS 11 + Prisma 7 + PostgreSQL
- Auth: Better Auth

**Agents:**
- orchestrator, architect, planner, backend, frontend, database, qa, security, devops

**Skills:**
- enterprise-architecture, senior-fullstack, turborepo, nestjs, prisma, orpc, nextjs, react, tailwind, shadcn, vitest, playwright, enterprise-security, enterprise-devops

**Critical Phases:**
- F1: Core Feature

**Immutable Rules:**
1. Testes desde o princípio (80% cobertura)
2. Contracts-first
3. Quality gates
4. Audit trail
5. Pesquisar antes de implementar
6. Execução rápida por defeito

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

## Template Comparison

| Feature | saas-b2b | saas-b2c | fintech | ecommerce | marketplace | healthcare | education | custom |
|---------|----------|----------|---------|-----------|-------------|------------|-----------|--------|
| Basic Auth | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| RBAC | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-tenant | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Compliance | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Audit Trail | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Payments | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Encryption | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Accessibility | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

## Agents Comparison

| Agent | saas-b2b | saas-b2c | fintech | ecommerce | marketplace | healthcare | education | custom |
|-------|----------|----------|---------|-----------|-------------|------------|-----------|--------|
| orchestrator | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| architect | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| planner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| backend | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| frontend | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| database | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| qa | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| security | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| devops | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| compliance | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Skills Comparison

| Skill | saas-b2b | saas-b2c | fintech | ecommerce | marketplace | healthcare | education | custom |
|-------|----------|----------|---------|-----------|-------------|------------|-----------|--------|
| enterprise-architecture | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| senior-fullstack | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| turborepo | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| nestjs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| prisma | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| orpc | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| better-auth | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| nextjs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| react | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| tailwind | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| shadcn | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| vitest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| playwright | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| enterprise-security | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| enterprise-devops | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| compliance | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| agt | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| saf-t | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Next Steps

- [Getting Started](GETTING-STARTED.md)
- [Customization](CUSTOMIZATION.md)
- [API Reference](API.md)
