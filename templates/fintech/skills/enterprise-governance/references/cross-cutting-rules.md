# Cross-Cutting Rules - {{PROJECT_NAME}}

Mapa de regras que afetam múltiplas skills.

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
| Tenant isolation | 7 | enterprise-governance §AG-01 |
| Audit trail | 5 | enterprise-governance §AG-02 |
| Design tokens | 5 | enterprise-governance §AG-04 |
| Hardcoded secrets | 3 | enterprise-governance §AG-03 |
| PCI-DSS | 2 | enterprise-governance §AG-05 |
| Contracts-first | 2 | enterprise-governance §AG-06 |
