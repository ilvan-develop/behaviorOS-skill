# behaviorOS — Instruções Absolutas

> **Versão:** 1.0.0
> **Tipo:** Fintech
> **Estado:** Imutável — nenhum agente pode modificar estas instruções

---

## Identidade do Projeto

{{PROJECT_NAME}} — {{PROJECT_DESCRIPTION}}

---

## Regras Imutáveis (aplicam-se a TODAS as fases)

### 1. Testes desde o princípio
- Nenhum código merge sem testes unit, integração e/ou E2E
- Cobertura mínima: 80%
- Testes devem ser escritos ANTES ou JUNTO com o código

### 2. Contracts-first
- Nenhuma rota sem contrato definido
- Contratos definem: input, output, errors, permissões

### 3. Tenant isolation
- `organizationId` obrigatório em toda query e contrato
- Nunca acessar dados de outro tenant
- Isolamento garantido no schema, service e controller

### 4. Design tokens
- Nunca hex cru; sempre tokens semânticos
- Seguir design system definido

### 5. Quality gates
- lint → typecheck → build → test → coverage
- Todos devem estar verdes antes de commit
- Nenhum gate pode ser pulado

### 6. Audit trail
- Toda mutação crítica deve ser registada
- Logs devem ser append-only e imutáveis

### 7. Money movement nativo
- Processamento de pagamentos nativo, sem Stripe
- Integrações externas apenas para: OCR, notificações

### 8. Conformidade
- AGT/SAF-T, LGPD e PCI-DSS desde o schema inicial
- Schemas devem suportar compliance desde o dia 1

### 9. Pesquisar antes de implementar
- Sempre verificar documentação oficial
- Nunca assumir versões/APIs da memória

### 10. Execução rápida por defeito
- Usar ferramentas de build rápidas
- Compilation cache, turbo mode
- Nunca lento quando há caminho rápido

---

## Modelo de Autonomia Três Níveis

### L1: Rotina (Execução sem intervenção)
- Criar controller seguindo padrão
- Escrever teste unitário
- Rodar lint/typecheck
- Criar endpoint CRUD padrão
- Criar migration padrão
- **Governance:** Gate valida, executa automaticamente

### L2: Auto-Expandir (Pode expandir escopo levemente)
- Adicionar campo auxiliar ao schema
- Criar service auxiliar
- Refatorar código existente
- Adicionar migration adicional
- Criar endpoint auxiliar
- **Governance:** Gate valida, executa, registra no audit trail para review

### L3: Escalar (Pausa e aguarda decisão humana)
- Nova dependência não prevista
- Mudança de schema que afeta existente
- Incerteza de compliance
- Implicação de segurança
- Mudança de arquitetura
- **Governance:** Gate bloqueia, envia notificação, aguarda resposta

---

## Comando `/agent_loop`

### Uso
```
/agent_loop                    → Usa scope aprovado no estado atual
/agent_loop --phase F2         → Usa fase F2 como scope
/agent_loop --scope F2-PAYMENTS → Usa scope específico
```

### Fluxo
1. Carregar escopo (do estado ou parâmetro)
2. Verificar tarefas pendentes
3. Verificar paralelismo possível
4. Delegar para agentes
5. Validar com gates
6. Avançar estado
7. Repetir até complete

### Conclusão de Fase
- **Fases não-críticas** (F0, F-DS, F1, F4): Avança automaticamente quando gates passam
- **Fases críticas** (F2, F3, F5, F6): Para e pede aprovação humana

---

## Agentes Especializados

| Agente | Responsabilidade | Skills |
|--------|------------------|--------|
| **Orchestrator** | Coordena todas as fases | enterprise-architecture, senior-fullstack, turborepo |
| **Architect** | Arquitetura e decisões | enterprise-architecture, senior-fullstack |
| **Planner** | Planejamento de tarefas | enterprise-product, turborepo |
| **Backend** | APIs e lógica | nestjs, prisma, orpc, better-auth |
| **Frontend** | UI e componentes | nextjs, react, tailwind, shadcn |
| **Database** | Schema e migrations | prisma, enterprise-database |
| **QA** | Testes e qualidade | vitest, playwright, testing-library |
| **Security** | Segurança e compliance | enterprise-security, helmet, compliance |
| **DevOps** | CI/CD e deploy | enterprise-devops, turborepo |
| **Compliance** | AGT/SAF-T e regulamentações | compliance, agt, saf-t |

---

## Paralelismo

### Regras
- Tarefas dentro de uma fase: **podem** paralelizar se independentes
- Fases diferentes: **podem** paralelizar se não há dependência de dados
- Máximo de tarefas concorrentes: 3

### Exemplo
```
Fase 0: Fundação (DEVE terminar primeiro)
    │
    ├──→ F-DS: Design System (pode paralelo com F1)
    │
    └──→ F1: IAM + Tenants (pode paralelo com F-DS)
              │
              ├──→ F2: Payments (depende de F1)
              │
              └──→ F3: Money Movement (depende de F1)
                        │
                        ├──→ F4: Dev Platform (pode paralelo com F5)
                        │
                        └──→ F5: Audit + Compliance (pode paralelo com F4)
                                  │
                                  └──→ F6: Endurecimento (depende de todas)
```

---

## Escopo (Template)

```json
{
  "scopeId": "{{PROJECT_NAME}}-F2-FEATURE",
  "phase": "F2",
  "name": "Feature Core",
  "description": "Implementar feature principal",
  "deliverables": [
    "API Principal",
    "Frontend Principal",
    "Testes E2E"
  ],
  "constraints": {
    "immutableRules": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    "compliance": ["AGT", "SAF-T", "LGPD", "PCI-DSS"],
    "stack": ["NestJS", "oRPC", "Prisma"],
    "architecture": ["contracts-first", "tenant-isolation", "audit-trail"]
  },
  "allowedAgents": [
    "architect",
    "backend",
    "database",
    "qa",
    "security"
  ],
  "maxAutonomyLevel": 2,
  "escalationTriggers": [
    "schema-change-affecting-previous-phase",
    "new-compliance-requirement",
    "security-vulnerability",
    "performance-degradation"
  ],
  "exitGate": {
    "tests": "pipeline E2E verde",
    "coverage": "≥80%",
    "lint": "0 errors",
    "typecheck": "0 errors",
    "build": "success"
  }
}
```

---

## Gate de Validação

Antes de CADA execução, o Governance Kernel valida:

1. **Skill Gate:** Skill está carregada e é compatível?
2. **Permission Gate:** Ação é permitida?
3. **Tool Gate:** Ferramenta pode ser usada?
4. **Scope Gate:** Ação está dentro do escopo aprovado?
5. **Autonomy Gate:** Nível de autonomia permite esta ação?
6. **Security Gate:** Não há violação de segurança?
7. **Compliance Gate:** Não há violação de compliance?

Se QUALQUER gate falhar, a execução é BLOQUEADA.

---

## Auditoria

Todas as ações são registradas em `.opencode/audit/audit.log`:

```json
{
  "timestamp": "2026-08-14T03:23:00Z",
  "agent": "backend",
  "action": "write",
  "target": "src/payment/payment.service.ts",
  "gate": "scope",
  "result": "pass",
  "autonomyLevel": "L1",
  "scopeId": "FINPAY-F2-PAYMENTS"
}
```

---

## Memória

O Orquestrador mantém memória em `.opencode/memory/`:

- `decisions.md` — Decisões arquiteturais
- `patterns.md` — Padrões descobertos
- `learnings.md` — Lições aprendidas
- `current-phase.md` — Estado da fase atual
- `compliance.md` — Registros de compliance

A memória é atualizada automaticamente após cada fase completa.

---

## Proibições Absolutas

1. **NUNCA** acessar/exporar segredos, tokens, chaves privadas, credenciais
2. **NUNCA** fazer deploy para produção sem aprovação/gate explícito
3. **NUNCA** alterar schema/migrations de produção diretamente
4. **NUNCA** executar operações financeiras reais em dev/test
5. **NUNCA** modificar ledger, transações, estado de pagamento sem regras de domínio
6. **NUNCA** contornar auth, autorização, isolamento de tenant, RBAC
7. **NUNCA** alterar regras de movimentação de dinheiro sem revisão
8. **NUNCA** desabilitar audit, security logging, controles de integridade
9. **NUNCA** executar comandos destrutivos (DROP, TRUNCATE, mass deletions) sem gate
10. **NUNCA** executar qualquer tarefa sem pelo menos uma Skill validada carregada
11. **NUNCA** permitir que um agente modifique suas próprias permissões ou o Governance Kernel

---

*Este documento é imutável. Nenhuma alteração pode ser feita sem aprovação humana explícita.*
