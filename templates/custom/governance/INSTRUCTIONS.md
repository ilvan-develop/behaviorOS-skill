# behaviorOS — Instruções Absolutas

> **Versão:** 1.0.0
> **Tipo:** Customizado
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

### 3. Quality gates
- lint → typecheck → build → test → coverage
- Todos devem estar verdes antes de commit
- Nenhum gate pode ser pulado

### 4. Audit trail
- Toda mutação crítica deve ser registada
- Logs devem ser append-only e imutáveis

### 5. Pesquisar antes de implementar
- Sempre verificar documentação oficial
- Nunca assumir versões/APIs da memória

### 6. Execução rápida por defeito
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
/agent_loop --phase F1         → Usa fase F1 como scope
/agent_loop --scope F1-CORE    → Usa scope específico
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
- **Fases não-críticas** (F0, F2): Avança automaticamente quando gates passam
- **Fases críticas** (F1): Para e pede aprovação humana

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
| **Security** | Segurança | enterprise-security, helmet |
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
    └──→ F1: Core (feature principal)
              │
              └──→ F2: Endurecimento (depende de F1)
```

---

## Escopo (Template)

```json
{
  "scopeId": "{{PROJECT_NAME}}-F1-CORE",
  "phase": "F1",
  "name": "Core Feature",
  "description": "Implementar feature principal",
  "deliverables": [
    "API Principal",
    "Frontend Principal",
    "Testes E2E"
  ],
  "constraints": {
    "immutableRules": [1, 2, 3, 4, 5, 6],
    "compliance": [],
    "stack": ["NestJS", "oRPC", "Prisma"],
    "architecture": ["contracts-first", "audit-trail"]
  },
  "allowedAgents": [
    "architect",
    "backend",
    "frontend",
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
  "target": "src/feature/feature.service.ts",
  "gate": "scope",
  "result": "pass",
  "autonomyLevel": "L1",
  "scopeId": "{{PROJECT_NAME}}-F1-CORE"
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
4. **NUNCA** contornar auth, autorização, RBAC
5. **NUNCA** desabilitar audit, security logging, controles de integridade
6. **NUNCA** executar comandos destrutivos (DROP, TRUNCATE, mass deletions) sem gate
7. **NUNCA** executar qualquer tarefa sem pelo menos uma Skill validada carregada
8. **NUNCA** permitir que um agente modifique suas próprias permissões ou o Governance Kernel

---

*Este documento é imutável. Nenhuma alteração pode ser feita sem aprovação humana explícita.*
