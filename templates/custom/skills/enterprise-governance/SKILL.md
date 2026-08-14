---
name: enterprise-governance
description: Governança cross-cutting do {{PROJECT_NAME}}. Use quando verificar regras que afetam múltiplas skills, validar anti-patterns transversais, ou consultar o single source of truth para tenant isolation, audit trail, secrets, e quality gates. Carregar antes de qualquer tarefa que envolva mais de um domínio.
metadata:
  scope: governance
  version: "1.0.0"
---

# Enterprise Governance - {{PROJECT_NAME}}

## 1. Visão Geral

Esta skill é o **single source of truth** para regras que afetam múltiplas skills do projeto. Cada skill técnica mantém os seus anti-patterns locais (domain-specific), mas regras transversais são centralizadas aqui.

**Carregar esta skill quando:**
- Implementar regras que afetam múltiplos domínios
- Verificar se código viola regras cross-cutting
- Criar ou atualizar skills que precisam de referenciar regras centrais

---

## 2. Regras Imutáveis (Referência)

| # | Regra | Referência |
|---|-------|------------|
| 1 | Testes desde o princípio | INSTRUCTIONS.md §1 |
| 2 | Contracts-first | INSTRUCTIONS.md §2 |
| 3 | Quality gates | INSTRUCTIONS.md §3 |
| 4 | Audit trail | INSTRUCTIONS.md §4 |
| 5 | Pesquisar antes de implementar | INSTRUCTIONS.md §5 |
| 6 | Execução rápida por defeito | INSTRUCTIONS.md §6 |

---

## 3. Anti-Patterns Cross-Cutting

### AG-01: Tenant isolation / organizationId

**Regra:** `organizationId` obrigatório em toda query e contrato.

**Skills que implementam:** prisma, nestjs

```typescript
// MAU
const users = await prisma.user.findMany();

// BOM
const users = await prisma.user.findMany({
  where: { organizationId }
});
```

### AG-02: Audit trail

**Regra:** Toda mutação crítica deve ser registada. Logs append-only e imutáveis.

**Skills que implementam:** nestjs, prisma

```typescript
// MAU - Mutação sem log
await prisma.record.update({ where: { id }, data: { status: 'DONE' } });

// BOM - Mutação com audit trail
await prisma.record.update({ where: { id }, data: { status: 'DONE' } });
await prisma.auditEvent.create({
  data: { eventType: 'RECORD_COMPLETED', entityId: id, timestamp: new Date().toISOString() }
});
```

### AG-03: Hardcoded secrets

**Regra:** Nunca armazenar segredos em código.

**Skills que implementam:** security

```typescript
// MAU
const API_KEY = "sk-1234567890abcdef";

// BOM
const API_KEY = process.env.API_KEY;
```

### AG-04: Quality gates

**Regra:** lint → typecheck → build → test → coverage. Todos verdes antes de commit.

### AG-05: Contracts-first

**Regra:** Nenhuma rota sem contrato definido.

---

## 4. Mapa de Referência

| Regra | Skills | Governance files |
|-------|--------|------------------|
| Tenant isolation | prisma, nestjs | INSTRUCTIONS.md, security-gates.json |
| Audit trail | nestjs, prisma | INSTRUCTIONS.md |
| Hardcoded secrets | security | security-gates.json, tool-gate.json |
| Quality gates | todas | INSTRUCTIONS.md |
| Contracts-first | nestjs, orpc | INSTRUCTIONS.md |

---

## 5. Convenções de Referência

Cada skill técnica que implementa uma regra cross-cutting deve incluir:

```markdown
### [Nome da Regra]
> **Regra central:** Ver `enterprise-governance` secção "[Nome da Secção]".
> Implementação específica deste contexto abaixo.

[Anti-pattern local]
```

---

## Referências

- `references/cross-cutting-rules.md` — Mapa completo
- `INSTRUCTIONS.md` — Regras imutáveis
- `security-gates.json` — Validações de segurança
