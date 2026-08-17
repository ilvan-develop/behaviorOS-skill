# my-project

> My project

---

## Visão Geral

my-project é uma fintech projetada para {{USE_CASE}}.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 16 + React 19 + Tailwind v4 + shadcn/ui |
| Backend | NestJS 11 + Prisma 7 + PostgreSQL |
| Auth | Better Auth |
| Fila | BullMQ + Redis |
| Testes | Vitest + Playwright |
| Monorepo | pnpm + Turborepo |

---

## Mapa de Fases

| Fase | Entrega | Gate |
|------|---------|------|
| F0 | Foundation | lint + typecheck + build |
| F1 | Auth + Tenants | Auth E2E verde |
| F2 | Payments | Pipeline E2E verde |
| F3 | Billing + Ledger | Billing E2E verde |
| F4 | Dev Platform | Webhook E2E verde |
| F5 | Audit + Compliance | Compliance ready |
| F6 | Launch | Release gate |

---

## Regras Imutáveis

1. Testes desde o princípio
2. Contracts-first
3. Tenant isolation
4. Quality gates
5. Audit trail
6. Conformidade AGT/SAF-T
7. LGPD e PCI-DSS

---

## Workflow

```
1. Ler README + docs
2. Iniciar Fase 0
3. Para cada fase:
   a. Ler requisitos
   b. Executar deliverables
   c. Correr gates
   d. Marcar fase completa
4. Não avançar sem gate verde
```
