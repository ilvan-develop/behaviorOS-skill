# Cross-Cutting Rules - FinPay

Mapa de regras que afetam múltiplas skills do projeto.

## Regras e Skills Afetadas

| Regra | Skills | Governance Files |
|-------|--------|------------------|
| Tenant isolation (`organizationId`) | prisma, nestjs, payments, financial-ledger | INSTRUCTIONS.md §3, security-gates.json, tool-gate.json |
| Audit trail | compliance, payments, financial-ledger, fintech-domain | INSTRUCTIONS.md §6 |
| Hardcoded secrets | security | security-gates.json, tool-gate.json |
| Design tokens / hex hardcoded | tailwind, ui-components | INSTRUCTIONS.md §4 |
| PCI-DSS card data | compliance | security-gates.json |
| Contracts-first | nestjs, orpc | INSTRUCTIONS.md §2 |
| Quality gates | todas | INSTRUCTIONS.md §5 |
| Float para dinheiro | prisma | — |

## Duplicações Resolvidas

| Conceito | Antes (locs) | Depois (1 local) |
|----------|--------------|-------------------|
| Tenant isolation | 7 | enterprise-governance AG-01 |
| Audit trail | 5 | enterprise-governance AG-02 |
| Design tokens | 5 | enterprise-governance AG-04 |
| Hardcoded secrets | 3 | enterprise-governance AG-03 |
| PCI-DSS | 2 | enterprise-governance AG-05 |
| Contracts-first | 2 | enterprise-governance AG-06 |

## Skills com Referências Cross-Cutting

| Skill | Regras referenciadas |
|-------|---------------------|
| prisma | AG-01 (tenant), AG-08 (float) |
| nestjs | AG-01 (tenant), AG-06 (contracts) |
| payments | AG-01 (tenant), AG-02 (audit) |
| financial-ledger | AG-01 (tenant), AG-02 (audit) |
| compliance | AG-02 (audit), AG-05 (PCI-DSS) |
| fintech-domain | AG-02 (audit) |
| security | AG-03 (secrets) |
| tailwind | AG-04 (design tokens) |
| ui-components | AG-04 (design tokens) |
| security | AG-04 (design tokens) |
