# behaviorOS — Instruções Absolutas

> **Versão:** 1.0.0
> **Tipo:** Fintech
> **Estado:** Imutável — nenhum agente pode modificar estas instruções

---

## Identidade do Projeto

fintech-angola — Fintech multi-tenant angolana de processamento de pagamentos

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

### 11. Consultar docs atualizadas antes de implementar
- SEMPRE usar context7 para verificar documentação oficial da lib/framework
- NUNCA assumir APIs ou versões da memória
- Verificar changelogs e breaking changes antes de upgrade
- Documentação é fonte de verdade, não código existente

### 12. Carregar skill relevante antes de cada tarefa
- ANTES de escrever código, carregar a skill correspondente
- Ler anti-patterns da skill antes de implementar
- Seguir convenções documentadas na skill
- Se não há skill, pesquisar melhores práticas antes de implementar

### 12.1 Log de skill selection
- ANTES de executar tarefa, registar no audit trail qual skill foi selecionada
- Formato: `[SKILL-LOAD] skill=<nome> agent=<agente> phase=<fase> timestamp=<ISO>`
- Exemplo: `[SKILL-LOAD] skill=nestjs agent=backend phase=F2 timestamp=2026-08-14T03:23:00Z`
- Logs ficam em `.opencode/audit/skill-selections.log`
- Formato JSONL para consumo programático:
  ```json
  {
    "timestamp": "2026-08-14T03:23:00Z",
    "event": "skill_load",
    "skill": "nestjs",
    "agent": "backend",
    "phase": "F2",
    "source": ".opencode/skills/nestjs",
    "result": "success"
  }
  ```

### 13. Anti-patterns são proibidos
- Verificar se o código viola anti-patterns documentados nas skills
- Se viola, corrigir antes de commit
- Cada skill tem sua lista de anti-patterns - consultar

### 14. Design system first
- ANTES de criar componente, verificar se existe no design system do projeto
- NUNCA importar componentes de UI directamente - sempre via package compartilhado
- Usar tokens semânticos, nunca hex hardcoded
- Criar documentação para todo componente novo

### 15. Anti-patterns cross-cutting
- Regras que afetam múltiplas skills vivem em `enterprise-governance`
- Cada skill referencia a regra central em vez de duplicar
- Verificar `enterprise-governance` antes de implementar regras transversais
- Anti-patterns locais documentam implementação específica do contexto

### 16. Enforcement Layer obrigatório
- ANTES de CADA tool call (write, edit, bash), executar enforcement script
- Comando: `.\scripts\enforce.ps1 -Tool "<tool>" -File "<file>" -Agent "<agent>" -Phase "<phase>"`
- Se exit code = 1, BLOQUEAR execução e reportar ao orchestrator
- Se exit code = 0, prosseguir com a execução
- Exception: operações de leitura (read) não requerem enforcement
- Para bash: incluir parâmetro `-Command "<comando>"`
- Exemplo: `.\scripts\enforce.ps1 -Tool "write" -File "packages/db/prisma/schema.prisma" -Agent "database" -Phase "F1"`
- Logs de enforcement ficam em `.opencode/audit/audit.log` e `.opencode/audit/audit.jsonl`

### 17. Skill tracking obrigatório
- ANTES de usar uma skill, registar com: `.\scripts\skill-tracker.ps1 -Skill "<skill>" -Agent "<agent>" -Phase "<phase>" -Action "load"`
- Listar skills carregadas: `.\scripts\skill-tracker.ps1 -Action "list"`
- Descarregar skill: `.\scripts\skill-tracker.ps1 -Skill "<skill>" -Agent "<agent>" -Phase "<phase>" -Action "unload"`
- Skills devem ser carregadas ANTES de escrever código que depende delas
- Enforcement script verifica skills obrigatórias para o tipo de arquivo

### 18. Agent Loop obrigatório para todas as fases
- Toda tarefa DEVE seguir o fluxo do agent loop antes de qualquer implementação
- Fluxo obrigatório: context7 resolve → context7 query → skill load → implementar → gate → advance
- ANTES de escrever QUALQUER código, executar:
  1. `context7_resolve-library-id` com o nome da lib/framework
  2. `context7_query-docs` com o library ID para obter docs atualizadas
  3. Verificar se a versão da doc corresponde à versão no `package.json` do projeto
  4. Carregar skill correspondente via `skill-tracker.ps1`
  5. Implementar usando APENAS APIs documentadas na versão correta
- Anti-pattern: escrever código sem consultar docs via context7
- Anti-pattern: usar APIs da memória em vez de documentação verificada
- Enforcement script valida se context7-mcp está no skills-loaded.json antes de permitir write/edit

### 19. Version pinning obrigatório
- SEMPRE verificar `package.json` do projeto para obter versões reais de todas as dependências
- Ao usar context7, incluir versão específica: `context7_query-docs` com `/org/project/version`
- Nunca assumir que uma lib está na versão X sem verificar no `package.json`
- Anti-pattern: escrever código para Prisma 6 quando o projeto usa Prisma 7
- Anti-pattern: usar APIs de NestJS 10 quando o projeto usa NestJS 11
- Anti-pattern: assumir breaking changes sem verificar changelog via context7
- Enforcement script valida se a versão consultada via context7 bate com a versão do projeto

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
  "scopeId": "fintech-angola-F2-FEATURE",
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
