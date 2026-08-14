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
- **Search:** Elasticsearch

## Fases

| Fase | Nome | Descrição |
|------|------|-----------|
| F0 | Fundação | Setup do projeto, CI/CD, linting |
| F1 | Auth + Users | Autenticação e gestão de usuários |
| F2 | Catálogo | Produtos, categorias, busca |
| F3 | Carrinho + Checkout | Carrinho, pedidos, pagamento |
| F4 | Gestão | Pedidos, estoque, relatórios |
| F5 | Endurecimento | Testes, segurança, performance |

## Regras Imutáveis

1. Testes desde o princípio (80% cobertura)
2. Contracts-first (contratos definem API)
3. Tenant isolation (multi-tenant se aplicável)
4. Quality gates (lint → typecheck → build → test)
5. Audit trail (registros append-only)
6. PCI-DSS (proteção de dados de pagamento)
7. LGPD (proteção de dados pessoais)
8. Pesquisar antes de implementar
9. Execução rápida por defeito

## Conformidade

- **PCI-DSS:** Dados de pagamento criptografados
- **LGPD:** Proteção de dados pessoais

---

*Gerado por behaviorOS-skill*
