# {{PROJECT_NAME}}

> {{PROJECT_DESCRIPTION}}

---

## Visão Geral

{{PROJECT_NAME}} é um SaaS B2B projetado para {{USE_CASE}}.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 16 + React 19 + Tailwind v4 + shadcn/ui |
| Backend | NestJS 11 + Prisma 7 + PostgreSQL |
| Auth | Better Auth |
| Testes | Vitest + Playwright |
| Monorepo | pnpm + Turborepo |

---

## Mapa de Fases

| Fase | Entrega | Gate |
|------|---------|------|
| F0 | Foundation | lint + typecheck + build |
| F1 | Auth | Auth E2E verde |
| F2 | Core Feature | Core E2E verde |
| F3 | Billing | Billing E2E verde |
| F4 | Launch | Release gate |

---

## Regras Imutáveis

1. Testes desde o princípio
2. Contracts-first
3. Quality gates
4. Audit trail

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
