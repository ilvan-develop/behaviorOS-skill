# behaviorOS — Instruções Absolutas

> **Versão:** 1.0.0
> **Tipo:** Marketplace
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
- Contratos definem: input, output, errors

### 3. Tenant isolation
- `organizationId` obrigatório em toda query
- Nunca acessar dados de outro tenant
- Isolamento garantido no schema, service e controller

### 4. Quality gates
- lint → typecheck → build → test → coverage
- Todos devem estar verdes antes de commit
- Nenhum gate pode ser pulado

### 5. Audit trail
- Toda mutação crítica deve ser registada
- Logs devem ser append-only e imutáveis

### 6. PCI-DSS
- Dados de pagamento criptografados
- Nunca armazenar CVV
- Tokenização de cartões

### 7. LGPD
- Proteção de dados pessoais desde o schema
- Consentimento obrigatório para coleta de dados
- Direito ao esquecimento implementado

### 8. Pesquisar antes de implementar
- Sempre verificar documentação oficial
- Nunca assumir versões/APIs da memória

### 9. Execução rápida por defeito
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
/agent_loop --phase F4         → Usa fase F4 como scope
/agent_loop --scope F4-ORDERS  → Usa scope específico
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
- **Fases não-críticas** (F0, F1, F2, F3): Avança automaticamente quando gates passam
- **Fases críticas** (F4, F5): Para e pede aprovação humana

---

## Agentes Especializados

| Agente | Responsabilidade | Skills |
|--------|------------------|--------|
| **Orchestrator** | Coordena todas as fases | enterprise-architecture, senior-fullstack, turborepo |
| **Architect** | Arquitetura e decisões | enterprise-architecture, senior-fullstack |
| **Planner** | Planejamento de tarefas | enterprise-product, turborepo |
| **Backend** | APIs e lógica | nestjs, prisma, orpc |
| **Frontend** | UI e componentes | nextjs, react, tailwind, shadcn |
| **Database** | Schema e migrations | prisma, enterprise-database |
| **QA** | Testes e qualidade | vitest, playwright, testing-library |
| **Security** | Segurança e compliance | enterprise-security, helmet, compliance |
| **DevOps** | CI/CD e deploy | enterprise-devops, turborepo |

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
    └──→ F1: Auth + Users
              │
              ├──→ F2: Vendedores (pode paralelo com F3)
              │
              └──→ F3: Produtos + Catálogo (pode paralelo com F2)
                        │
                        └──→ F4: Pedidos + Pagamento (depende de F2 e F3)
                                  │
                                  └──→ F5: Endurecimento (depende de todas)
```

---

## Escopo (Template)

```json
{
  "scopeId": "{{PROJECT_NAME}}-F4-ORDERS",
  "phase": "F4",
  "name": "Pedidos + Pagamento",
  "description": "Implementar fluxo de pedidos e pagamento",
  "deliverables": [
    "API de Pedidos",
    "API de Pagamento",
    "Integração Gateway",
    "Testes E2E"
  ],
  "constraints": {
    "immutableRules": [1, 2, 3, 4, 5, 6, 7, 8, 9],
    "compliance": ["PCI-DSS", "LGPD"],
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
  "target": "src/order/order.service.ts",
  "gate": "scope",
  "result": "pass",
  "autonomyLevel": "L1",
  "scopeId": "{{PROJECT_NAME}}-F4-ORDERS"
}
```

---

## Memória

O Orquestrador mantém memória em `.opencode/memory/`:

- `decisions.md` — Decisões arquiteturais
- `patterns.md` — Padrões descobertos
- `learnings.md` — Lições aprendidas
- `current-phase.md` — Estado da fase atual

A memória é atualizada automaticamente após cada fase completa.

---

## Proibições Absolutas

1. **NUNCA** acessar/exporar segredos, tokens, chaves privadas, credenciais
2. **NUNCA** fazer deploy para produção sem aprovação/gate explícito
3. **NUNCA** alterar schema/migrations de produção diretamente
4. **NUNCA** executar operações financeiras reais em dev/test
5. **NUNCA** contornar auth, autorização, RBAC
6. **NUNCA** armazenar CVV ou dados sensíveis de pagamento em texto plano
7. **NUNCA** desabilitar audit, security logging, controles de integridade
8. **NUNCA** executar comandos destrutivos (DROP, TRUNCATE, mass deletions) sem gate
9. **NUNCA** executar qualquer tarefa sem pelo menos uma Skill validada carregada
10. **NUNCA** permitir que um agente modifique suas próprias permissões ou o Governance Kernel

---

*Este documento é imutável. Nenhuma alteração pode ser feita sem aprovação humana explícita.*
