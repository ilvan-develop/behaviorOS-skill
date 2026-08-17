---
description: Checklist de release/producao — CD como autoridade final, nunca push directo sem gates
agent: build
---
Checklist de release para producao (OAGE §36, §60). O CI e a autoridade final: uma tarefa que um agente declara "COMPLETED" nao esta aceite ate o CI passar.

Percorrer, nesta ordem, e reportar PASS/FAIL em cada passo (nao avancar para o passo seguinte se o anterior falhar):

1. `node scripts/validate.mjs`
2. `node scripts/lint.mjs`
3. `pnpm test` (ou equivalente do projecto)
4. `pnpm build` (ou equivalente do projecto)
5. Verificar `.opencode/governance/production-gate.json` — todos os checks `required: true` satisfeitos?
6. Verificar se todas as fases criticas em `state-machine.json` tem `status: completed` com evidencia em `.opencode/evidence/{fase}.json` (ver `definition-of-done.json`)
7. Verificar se existe aprovacao humana explicita registada (produção requer `requireHumanApproval: true`)

NUNCA fazer `git push` para a branch de producao ou correr um comando de deploy a partir deste comando. O resultado deste checklist e informacao para o humano decidir — a decisao final e sempre humana (ver `production-gate.json.approvalRequired`).
