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
- **Encryption:** AES-256, RSA

## Fases

| Fase | Nome | Descrição |
|------|------|-----------|
| F0 | Fundação | Setup do projeto, CI/CD, linting |
| F1 | Auth + Users | Autenticação e gestão de usuários |
| F2 | Pacientes | Cadastro e gestão de pacientes |
| F3 | Prontuários | Prontuários eletrônicos |
| F4 | Agendamentos | Consultas e agendamentos |
| F5 | Endurecimento | Testes, segurança, performance |

## Regras Imutáveis

1. Testes desde o princípio (80% cobertura)
2. Contracts-first (contratos definem API)
3. Tenant isolation (multi-tenant obrigatório)
4. Quality gates (lint → typecheck → build → test)
5. Audit trail (registros append-only)
6. LGPD (proteção de dados pessoais)
7. Criptografia de dados sensíveis
8. Pesquisar antes de implementar
9. Execução rápida por defeito

## Conformidade

- **LGPD:** Proteção de dados pessoais
- **HIPAA:** Proteção de dados de saúde (se aplicável)
- **CFM:** Resoluções do Conselho Federal de Medicina

---

*Gerado por behaviorOS-skill*
