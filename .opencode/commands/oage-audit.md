---
description: Audita arquitectura, agentes, skills, permissoes, dependencias, seguranca, testes, CI/CD e anti-patterns
agent: build
---
Executa uma auditoria completa de governanca OAGE (§48), cobrindo:

- architecture — respeita `AGENTS.md` / docs de arquitectura existentes?
- agents — todos os agentes em `opencode.json` tem skills, mode e responsabilidades claras?
- skills — as skills carregadas correspondem ao `skill-gate.json` da fase actual? Plugin `skill-gate-auto.json` verifica extensoes de ficheiro?
- permissions — `opencode.json` e `permissions-matrix.json` estao consistentes?
- runtime-gates — os 10 gates de `oage-enforce.js` estao activos? (protected-resources, anti-patterns, dependency, truth, loop, skill-tracking, context7, quality, agent-loop, version-pinning)
- context/dependencies — houve `npm install`/`pnpm add` sem evento `dependency_justification` no audit trail?
- security — `.opencode/governance/security-gates.json` e `anti-patterns.json` (categoria security) foram violados nos ultimos commits?
- testing — cobertura actual vs. `production-gate.json` threshold?
- ci/cd — `.github/workflows/oage-ci.yml` esta presente e o ultimo run passou?
- documentation — README/AGENTS.md foram actualizados quando a arquitectura mudou?
- anti-patterns — correr `node scripts/lint.mjs --anti-patterns-only` e reportar achados
- observability — correr `node scripts/oage-metrics.mjs` e reportar

Para cada area, devolve um veredicto: APPROVED / APPROVED_WITH_WARNINGS / CHANGES_REQUIRED / BLOCKED (OAGE §51), com a lista concreta de ficheiros/linhas que motivam o veredicto. Nao alterar codigo — esta auditoria e read-only.
