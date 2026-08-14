# Cross-Cutting Rules - {{PROJECT_NAME}}

Mapa de regras que afetam múltiplas skills.

## Regras e Skills Afetadas

| Regra | Skills | Governance Files |
|-------|--------|------------------|
| Tenant isolation (`organizationId`) | prisma, nestjs | INSTRUCTIONS.md, security-gates.json |
| Audit trail | nestjs, prisma | INSTRUCTIONS.md |
| Hardcoded secrets | security | security-gates.json, tool-gate.json |
| Quality gates | todas | INSTRUCTIONS.md |
| Contracts-first | nestjs, orpc | INSTRUCTIONS.md |
