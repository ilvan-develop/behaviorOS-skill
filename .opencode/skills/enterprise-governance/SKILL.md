---
name: enterprise-governance
description: Governança cross-cutting do {{PROJECT_NAME}}. Use quando verificar regras que afetam múltiplas skills, validar anti-patterns transversais, ou consultar o single source of truth para tenant isolation, audit trail, design tokens, secrets, e PCI-DSS. Carregar antes de qualquer tarefa que envolva mais de um domínio.
metadata:
  scope: governance
  version: "1.0.0"
---

# Enterprise Governance - {{PROJECT_NAME}}

## 1. Visão Geral

Esta skill é o **single source of truth** para regras que afetam múltiplas skills do projeto. Cada skill técnica mantém os seus anti-patterns locais (domain-specific), mas regras transversais são centralizadas aqui.

**Carregar esta skill quando:**
- Implementar regras que afetam múltiplos domínios (tenant isolation, audit trail)
- Verificar se código viola regras cross-cutting
- Criar ou atualizar skills que precisam de referenciar regras centrais
- Auditar conformidade transversal

**Não carregar quando:**
- Trabalhar apenas dentro de um domínio específico (usar skill desse domínio)
- Configurar Turborepo (usar skill `turbo`)

---

## 2. Regras Imutáveis (Referência)

Estas regras estão definidas em `INSTRUCTIONS.md` e aplicam-se a TODAS as fases:

| # | Regra | Referência |
|---|-------|------------|
| 1 | Testes desde o princípio | INSTRUCTIONS.md §1 |
| 2 | Contracts-first | INSTRUCTIONS.md §2 |
| 3 | Tenant isolation | INSTRUCTIONS.md §3 |
| 4 | Design tokens | INSTRUCTIONS.md §4 |
| 5 | Quality gates | INSTRUCTIONS.md §5 |
| 6 | Audit trail | INSTRUCTIONS.md §6 |
| 7 | Money movement nativo | INSTRUCTIONS.md §7 |
| 8 | Conformidade AGT/SAF-T | INSTRUCTIONS.md §8 |
| 9 | Pesquisar antes de implementar | INSTRUCTIONS.md §9 |
| 10 | Execução rápida por defeito | INSTRUCTIONS.md §10 |

---

## 3. Anti-Patterns Cross-Cutting

### AG-01: Tenant isolation / organizationId

**Regra:** `organizationId` obrigatório em toda query e contrato. Nunca aceder a dados de outro tenant.

**Skills que implementam:** prisma, nestjs, payments, financial-ledger

```typescript
// MAU - Query sem organizationId
const users = await prisma.user.findMany();

// BOM - Query com tenant isolation
const users = await prisma.user.findMany({
  where: { organizationId }
});
```

```typescript
// MAU - Contrato sem organizationId
const paymentSchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

// BOM - Contrato com organizationId
const paymentSchema = z.object({
  organizationId: z.string().uuid(),
  amount: z.number(),
  currency: z.string(),
});
```

### AG-02: Audit trail

**Regra:** Toda mutação crítica deve ser registada. Logs devem ser append-only e imutáveis.

**Skills que implementam:** compliance, payments, financial-ledger, fintech-domain

```typescript
// MAU - Mutação sem log
await prisma.payment.update({
  where: { id },
  data: { status: 'COMPLETED' }
});

// BOM - Mutação com audit trail
await prisma.payment.update({
  where: { id },
  data: { status: 'COMPLETED' }
});
await prisma.auditEvent.create({
  data: {
    eventType: 'PAYMENT_COMPLETED',
    entityId: id,
    organizationId,
    timestamp: new Date().toISOString(),
  }
});
```

### AG-03: Hardcoded secrets

**Regra:** Nunca armazenar segredos, tokens, chaves privadas ou credenciais em código.

**Skills que implementam:** security

```typescript
// MAU
const API_KEY = "sk-1234567890abcdef";
const dbPassword = "supersecret123";

// BOM
const API_KEY = process.env.API_KEY;
const dbPassword = process.env.DATABASE_PASSWORD;
```

### AG-04: Design tokens

**Regra:** Nunca hex cru; sempre tokens semânticos. Seguir design system definido.

**Skills que implementam:** tailwind, ui-components

```tsx
// MAU
<div className="bg-[#1a1a1a] text-[#ffffff]">

// BOM
<div className="bg-card text-card-foreground">
```

### AG-05: PCI-DSS card data

**Regra:** Nunca armazenar números de cartão, CVVs ou datas de expiração em texto plaintext. Usar tokenização.

**Skills que implementam:** compliance

```typescript
// MAU
await prisma.payment.create({
  data: {
    cardNumber: "4111111111111111",
    cvv: "123",
  }
});

// BOM
await prisma.payment.create({
  data: {
    cardToken: "tok_visa_4111",
    lastFour: "1111",
  }
});
```

### AG-06: Contracts-first

**Regra:** Nenhuma rota sem contrato definido. Contratos definem: input, output, errors, permissões.

**Skills que implementam:** nestjs, orpc

```typescript
// MAU - Rota sem contrato
@Get('payments')
async getPayments() { ... }

// BOM - Rota com contrato
const getPaymentsContract = oc.route({
  input: z.object({ organizationId: z.string().uuid() }),
  output: z.array(PaymentSchema),
});
```

### AG-07: Quality gates

**Regra:** lint → typecheck → build → test → coverage. Todos devem estar verdes antes de commit.

**Skills que implementam:** todas (via INSTRUCTIONS.md Rule 5)

### AG-08: Float para dinheiro

**Regra:** Nunca usar `Float` para valores monetários. Usar `Decimal @db.Decimal(19, 4)`.

**Skills que implementam:** prisma

```prisma
// MAU
amount Float

// BOM
amount Decimal @db.Decimal(19, 4)
```

---

## 4. Mapa de Referência

| Regra | Skills que implementam | Governance files |
|-------|----------------------|------------------|
| Tenant isolation | prisma, nestjs, payments, financial-ledger | INSTRUCTIONS.md §3, security-gates.json, tool-gate.json |
| Audit trail | compliance, payments, financial-ledger, fintech-domain | INSTRUCTIONS.md §6 |
| Hardcoded secrets | security | security-gates.json, tool-gate.json |
| Design tokens | tailwind, ui-components | INSTRUCTIONS.md §4 |
| PCI-DSS | compliance | security-gates.json |
| Contracts-first | nestjs, orpc | INSTRUCTIONS.md §2 |
| Quality gates | todas | INSTRUCTIONS.md §5 |
| Float para dinheiro | prisma | — |

---

## 5. Convenções de Referência

Cada skill técnica que implementa uma regra cross-cutting deve incluir:

```markdown
### [Nome da Regra]
> **Regra central:** Ver `enterprise-governance` secção "[Nome da Secção]".
> Implementação específica deste contexto abaixo.

[Anti-pattern local com exemplos MAU/BOM]
```

---

## 6. Script de Verificação

```bash
#!/bin/bash
# scripts/fitness-check.sh

echo "=== Fitness Functions - {{PROJECT_NAME}} ==="

# 1. Verificar PrismaClient isolado
echo "[1/4] Verificar PrismaClient..."
BAD=$(grep -r "new PrismaClient" packages/*/src/ apps/*/src/ --include="*.ts" -l 2>/dev/null | grep -v "packages/db/" || true)
if [ -n "$BAD" ]; then
  echo "ERRO: PrismaClient fora de @finpay/db: $BAD"
  exit 1
fi
echo "  OK"

# 2. Verificar importações shadcn diretas
echo "[2/4] Verificar importações shadcn..."
BAD=$(grep -r "from.*@/components/ui" packages/*/src/ apps/*/src/ --include="*.ts" --include="*.tsx" -l 2>/dev/null || true)
if [ -n "$BAD" ]; then
  echo "ERRO: Importações shadcn diretas: $BAD"
  exit 1
fi
echo "  OK"

# 3. Verificar dependências circulares
echo "[3/4] Verificar dependências circulares..."
npx madge --circular --ts-config ./tsconfig.base.json --extensions ts packages/ apps/ 2>/dev/null
if [ $? -ne 0 ]; then
  echo "ERRO: Dependências circulares encontradas"
  exit 1
fi
echo "  OK"

# 4. Verificar deriva de dependências
echo "[4/4] Verificar deriva de dependências..."
npx sherif 2>/dev/null
if [ $? -ne 0 ]; then
  echo "ERRO: Discrepâncias de versão encontradas"
  exit 1
fi
echo "  OK"

echo "=== Todas as fitness functions passaram ==="
```

---

## Referências

- `references/cross-cutting-rules.md` — Mapa completo de regras transversais
- `INSTRUCTIONS.md` — Regras imutáveis do projeto
- `security-gates.json` — Validações de segurança
- `tool-gate.json` — Validações de ferramentas
