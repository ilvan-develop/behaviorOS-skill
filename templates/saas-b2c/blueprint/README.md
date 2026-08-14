# {{PROJECT_NAME}}

> {{PROJECT_DESCRIPTION}}

## Stack

- **Frontend:** Next.js 16+, React 19+, TypeScript, Tailwind CSS
- **Backend:** NestJS 11+, TypeScript
- **Database:** PostgreSQL 16+ com Prisma 7
- **Auth:** Better Auth
- **API:** REST + oRPC
- **Queue:** BullMQ + Redis
- **Cache:** Redis

## Fases

| Fase | Nome | Descrição |
|------|------|-----------|
| F0 | Fundação | Setup do projeto, CI/CD, linting |
| F1 | Auth + Users | Autenticação e gestão de usuários |
| F2 | Core Feature | Feature principal do SaaS |
| F3 | Billing | Assinaturas e pagamentos |
| F4 | Endurecimento | Testes, segurança, performance |

## Regras Imutáveis

1. Testes desde o princípio (80% cobertura)
2. Contracts-first (contratos definem API)
3. Quality gates (lint → typecheck → build → test)
4. Audit trail (registros append-only)
5. LGPD (proteção de dados desde o schema)
6. Pesquisar antes de implementar
7. Execução rápida por defeito

## Conformidade

- **LGPD:** Proteção de dados pessoais
- **PCI-DSS:** Se processar pagamentos

---

*Gerado por behaviorOS-skill*
