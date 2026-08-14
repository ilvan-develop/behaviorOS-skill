---
name: enterprise-governance
description: Governança cross-cutting do {{PROJECT_NAME}}. Use quando verificar regras que afetam múltiplas skills, validar anti-patterns transversais, ou consultar o single source of truth para tenant isolation, audit trail, PCI-DSS, secrets, e quality gates. Carregar antes de qualquer tarefa que envolva mais de um domínio.
metadata:
  scope: governance
  version: "1.0.0"
---

# Enterprise Governance - {{PROJECT_NAME}}

## 1. Visão Geral

Esta skill é o **single source of truth** para regras que afetam múltiplas skills do projeto. Cada skill técnica mantém os seus anti-patterns locais, mas regras transversais são centralizadas aqui.

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
| 3 | Tenant isolation | INSTRUCTIONS.md §3 |
| 4 | Quality gates | INSTRUCTIONS.md §4 |
| 5 | Audit trail | INSTRUCTIONS.md §5 |
| 6 | PCI-DSS | INSTRUCTIONS.md §6 |
| 7 | LGPD | INSTRUCTIONS.md §7 |
| 8 | Pesquisar antes de implementar | INSTRUCTIONS.md §8 |
| 9 | Execução rápida por defeito | INSTRUCTIONS.md §9 |

---

## 3. Anti-Patterns Cross-Cutting

### AG-01: Tenant isolation / organizationId

**Regra:** `organizationId` obrigatório em toda query e contrato.

**Skills que implementam:** prisma, nestjs

```typescript
// MAU
const products = await prisma.product.findMany();

// BOM
const products = await prisma.product.findMany({
  where: { organizationId }
});
```

### AG-02: Audit trail

**Regra:** Toda mutação crítica deve ser registada.

**Skills que implementam:** nestjs, prisma

### AG-03: Hardcoded secrets

**Regra:** Nunca armazenar segredos em código.

**Skills que implementam:** security

### AG-04: PCI-DSS card data

**Regra:** Nunca armazenar números de cartão, CVVs ou datas de expiração em texto plaintext. Usar tokenização.

**Skills que implementam:** payments, compliance

```typescript
// MAU
await prisma.order.create({
  data: { cardNumber: "4111111111111111", cvv: "123" }
});

// BOM
await prisma.order.create({
  data: { cardToken: "tok_visa_4111", lastFour: "1111" }
});
```

### AG-05: Quality gates

**Regra:** lint → typecheck → build → test → coverage. Todos verdes antes de commit.

### AG-06: Contracts-first

**Regra:** Nenhuma rota sem contrato definido.

---

## 4. Mapa de Referência

| Regra | Skills | Governance files |
|-------|--------|------------------|
| Tenant isolation | prisma, nestjs | INSTRUCTIONS.md, security-gates.json |
| Audit trail | nestjs, prisma | INSTRUCTIONS.md |
| Hardcoded secrets | security | security-gates.json, tool-gate.json |
| PCI-DSS | payments, compliance | security-gates.json |
| Quality gates | todas | INSTRUCTIONS.md |
| Contracts-first | nestjs, orpc | INSTRUCTIONS.md |

---

## 5. Convenções de Referência

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
