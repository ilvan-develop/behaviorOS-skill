
---

## Regras OAGE Adicionais (20-30)

> Estas regras são anexadas automaticamente a todos os templates pelo gerador de governança
> (`core/generator.mjs`) e aplicadas em runtime pelos plugins `.opencode/plugins/oage-enforce.js`
> e `.opencode/plugins/oage-audit.js`.

### 20. Recursos protegidos nunca são acessíveis
- `.env`, `secrets/`, `credentials/`, chaves privadas, ficheiros `.pem`/`.key`/`id_rsa*` nunca podem ser lidos ou escritos por um agente.
- Bloqueado automaticamente em runtime pelo plugin `oage-enforce.js`.

### 21. Anti-patterns são verificados automaticamente
- Antes de cada `write`/`edit`, o conteúdo é validado contra `.opencode/governance/anti-patterns.json`.
- Padrões com `severity: critical` bloqueiam a escrita.

### 22. Loop Detection obrigatório
- Se a mesma acção se repetir `maxIdenticalAttempts` vezes dentro da janela definida, a execução é bloqueada.

### 23. Dependências novas exigem justificação registada
- Antes de `npm install`/`pnpm add` de um pacote fora do lockfile, registar evento `dependency_justification`.

### 24. Truth Gate — confiança mínima para ficheiros críticos
- Antes de escrever em ficheiros críticos, evento `confidence_declared` com valor ≥ `minConfidence`.

### 25. Revisão independente em fases críticas
- Fase crítica só pode ser marcada `completed` depois de `review_approved` por agente diferente.
- **Limitação conhecida**: o hook `tool.execute` do OpenCode não expõe o nome do agente (só `sessionID`/`callID` — verificado em `@opencode-ai/plugin`), pelo que escritas automáticas ficam registadas com `agent: "unknown"`. `scripts/reviewer-check.mjs` falha fechado (bloqueia) nesse caso em vez de aceitar qualquer revisor como "independente" — a revisão de uma fase crítica tem de ser declarada explicitamente via `node scripts/audit-event.mjs --event review_approved --agent <revisor> --reviewedBy <revisor>`, com confirmação humana de que é de facto um agente diferente de quem implementou.

### 26. Handoff estruturado entre agentes/fases
- Gerar documento de handoff via `node scripts/handoff.mjs` seguindo `handoff-schema.json`.

### 27. Evidência obrigatória antes de declarar concluído
- Nenhuma fase pode ser marcada `completed` sem ficheiro de evidência em `.opencode/evidence/{phase}.json`.

### 28. Context7 obrigatório antes de implementar (ADAPTIVE)
- ANTES de escrever/editar código, chamar `context7_resolve-library-id` e `context7_query-docs`.
- O plugin bloqueia write/edit se não houver chamada context7 recente.
- Janela configurável por operação em `policy-resolver.json`.

### 29. Quality gates antes de commit (ENFORCED BY PLUGIN)
- Antes de `git commit`, o plugin executa lint, typecheck e test.
- Configuração em `tool-gate.json`.

### 30. Behavior Resolution (NOVA ARQUITETURA)
- **Risk Assessment**: Calculado por propriedades da fase (isCritical, position), operação e arquivo.
  - LOW: read, lint, edit-readme
  - MEDIUM: edit-component, edit-config
  - HIGH: edit-service, edit-schema
  - CRITICAL: edit-auth, edit-payment, edit-migration
- **Policy Resolution**: Risk level determina enforcement intensity.
  - LOW: off (sem gates)
  - MEDIUM: off (skill-gate pode "warn", nunca bloqueia)
  - HIGH: require context7, require skills (modo one-of/all conforme `policy-resolver.json`), require knowledge (grounding no repo)
  - CRITICAL: require context7, require skills, require truth, require knowledge
- **Grounding Evidence**: O audit plugin grava `grounding_evidence` para cada leitura de:
  - package.json (repo-state, confidence: 100)
  - context7 (official-docs, confidence: 90)
  - skill (domain-knowledge, confidence: 85)
  - governance files (governance-context, confidence: 85)
- **Knowledge Hierarchy**: Hierarquia de fontes de verdade (`knowledge-hierarchy.json`).
  - Level 1-3: Repo, Architecture, Versions — exigido para HIGH/CRITICAL (Knowledge Gate). Deliberadamente NÃO inclui o nível 4 sozinho: aceitar só "Official Docs" tornaria este gate redundante com o Context7 Gate (toda operação HIGH/CRITICAL já exige context7). O agente tem de mostrar grounding no próprio repositório, não só na documentação externa.
  - Level 4: Official Docs — exigido pelo Context7 Gate separadamente
  - Level 5-6: Skills, Patterns — contam para MEDIUM (warn), não chegam sozinhos para HIGH/CRITICAL
  - Level 7-8: Agent Knowledge, Assumptions — nunca suficientes para implementação
- **Execution Protocol**: 11 passos cognitivos UNDERSTAND→LEARN.
- **Behavior Contract**: Contrato de comportamento por operação.

---

## Configuração

### Arquivos de Governança (Behavior Resolution)
- `risk-engine.json` — Risk assessment por phase properties
- `policy-resolver.json` — Enforcement rules por risk level
- `execution-protocol.json` — 11 passos cognitivos
- `knowledge-hierarchy.json` — 8 níveis de fontes de verdade
- `behavior-contract.json` — Contrato por operação

### Engines (Runtime)
- `plugins/lib/risk-engine.js` — Cálculo de risk
- `plugins/lib/policy-resolver.js` — Resolução de policies
- `plugins/lib/skill-engine.js` — Detecção de tecnologias
- `plugins/lib/protocol-engine.js` — Validação de steps

### Legacy Gates (Desativados)
- `context7-gate.json` → `enabled: false`
- `truth-gate.json` → `enabled: false`
- `skill-gate-auto.json` → `enabled: false`
- `skill-gate.json` → `deprecated: true` (usava IDs de fase hardcoded F0-F6; substituído por `policy-resolver.json` + deteção de tecnologia por ficheiro/conteúdo)
