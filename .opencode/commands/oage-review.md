---
description: Revisao read-only do diff actual contra arquitectura, seguranca, testes e anti-patterns
agent: build
---
Revisao read-only do diff pendente (OAGE §50). NUNCA alterar codigo nesta revisao.

Fluxo:
1. `git diff` (staged + unstaged) para ver o que mudou
2. Verificar se o diff respeita a arquitectura existente (nao duplica componentes, nao introduz abstraccao prematura)
3. Verificar `.opencode/governance/anti-patterns.json` — algum ficheiro alterado corresponde a um padrao critico?
4. Verificar `.opencode/governance/security-gates.json` contra o diff
5. Verificar se testes foram adicionados/actualizados para o codigo alterado
6. Verificar se ficheiros fora do escopo da tarefa foram tocados

Termina com um veredicto explicito: APPROVED / APPROVED_WITH_WARNINGS / CHANGES_REQUIRED / BLOCKED, e para fases criticas lembra que a conclusao requer um evento `review_approved` de um agente diferente do implementador (ver `.opencode/governance/reviewer-gate.json`) — gera-o com `node scripts/audit-event.mjs --event review_approved --agent <teu-nome> --phase <fase> --reviewedBy <teu-nome>` se aprovares.
