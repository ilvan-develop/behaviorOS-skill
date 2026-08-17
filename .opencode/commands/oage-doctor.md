---
description: Verifica a saude da instalacao de governanca (agents, skills, permissions, MCP, plugins, CI)
agent: build
---
Executa um diagnostico de saude do OAGE/behaviorOS neste projecto (OAGE §47).

Corre e reporta o resultado de cada um destes passos, sem alterar nenhum ficheiro:

1. `node scripts/validate.mjs` — validade da configuracao de governanca
2. `node scripts/lint.mjs` — JSON valido + scan de segredos + anti-patterns criticos
3. Verificar se `.opencode/plugins/oage-enforce.js` e `.opencode/plugins/oage-audit.js` existem
4. Verificar se `.opencode/governance/{anti-patterns,protected-resources,loop-detector,dependency-gate,truth-gate,context7-gate,version-pinning-gate,skill-gate-auto,reviewer-gate,mcp-registry,handoff-schema,definition-of-done,ci-gate}.json` existem e sao JSON valido
5. Verificar se `.github/workflows/oage-ci.yml` existe
6. Ler `opencode.json` e confirmar que NAO tem chave `governance` (schema invalida) e tem `plugin: []`
7. Correr `node scripts/oage-metrics.mjs` e reportar tool_denial_rate, policy_violation_rate e loop_detection_rate

Reporta no formato:

```
OAGE HEALTH
Agents        PASS/FAIL
Skills        PASS/FAIL
Permissions   PASS/FAIL
MCP           PASS/WARN/FAIL
Plugins       PASS/FAIL
CI            PASS/WARN/FAIL
Governance    PASS/FAIL

BLOCKERS: <numero>
```

Lista cada bloqueador encontrado com o ficheiro/comando exacto para o corrigir. Nao corrigir nada automaticamente — apenas diagnosticar.
