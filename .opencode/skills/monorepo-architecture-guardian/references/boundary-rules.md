# Boundary Rules - Limites de Pacotes FinPay

Templates de configuração para imposição de limites arquitetónicos.

## 1. Regras de Dependência por Contexto

### Contextos delimitados (Bounded Contexts)

```
┌─────────────────────────────────────────────────────────┐
│                    COMPLIANCE & AUDIT                    │
│                   (Conformist - consome todos)           │
└──────────────────────┬──────────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
┌────────┐      ┌────────────┐     ┌──────────┐
│  IAM   │─────►│  PAYMENTS  │────►│  MONEY   │
│        │      │            │     │ MOVEMENT │
└───┬────┘      └─────┬──────┘     └──────────┘
    │                  │
    │                  ▼
    │           ┌────────────┐
    ├──────────►│  BILLING   │
    │           └────────────┘
    │
    ▼
┌────────┐      ┌────────────┐
│TENANTS │─────►│  WEBHOOKS  │──► NOTIFICATIONS
└────────┘      └────────────┘
```

### Mapeamento para packages/

| Contexto | Package | Pode importar de |
|----------|---------|-----------------|
| IAM | `packages/auth` | `@finpay/contracts`, `@finpay/db` |
| Tenants | `packages/db` (tenant logic) | `@finpay/contracts` |
| Payments | `apps/api` (payment module) | `@finpay/contracts`, `@finpay/db`, `@finpay/auth` |
| Billing | `apps/api` (billing module) | `@finpay/contracts`, `@finpay/db` |
| Money Movement | `apps/api` (ledger module) | `@finpay/contracts`, `@finpay/db` |
| Webhooks | `apps/api` (webhook module) | `@finpay/contracts`, `@finpay/observability` |
| Compliance & Audit | `packages/observability` | `@finpay/contracts` |
| Design System | `packages/ui` | Nenhum package de domínio |
| Shared Kernel | `packages/contracts`, `packages/validation` | Nenhum |

## 2. Configuração eslint-plugin-boundaries

```javascript
// eslint.config.mjs
import boundaries from "eslint-plugin-boundaries";

const FINPAY_RULES = {
  // Apps -终点, não podem ser importados
  apps: {
    type: "app",
    pattern: "apps/*",
    canImportFrom: [], // Apps não são importados por ninguém
  },

  // Shared Kernel - qualquer um pode importar
  sharedKernel: [
    { type: "shared", pattern: "packages/contracts" },
    { type: "shared", pattern: "packages/validation" },
  ],

  // UI Library - isolada do domínio
  ui: {
    type: "ui",
    pattern: "packages/ui",
    canImportFrom: ["shared"], // Só pode importar de shared
  },

  // Domain Packages - dependência dirigida
  domain: [
    { type: "domain", pattern: "packages/db", canImportFrom: ["shared"] },
    { type: "domain", pattern: "packages/auth", canImportFrom: ["shared", "domain:db"] },
    { type: "domain", pattern: "packages/observability", canImportFrom: ["shared"] },
    { type: "domain", pattern: "packages/sdk", canImportFrom: ["shared", "domain:db"] },
  ],

  // Infrastructure
  infra: {
    type: "infra",
    pattern: "packages/test-helpers",
    canImportFrom: ["shared", "domain", "ui", "app"],
  },
};

export default [
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        ...FINPAY_RULES.apps.map(e => ({ ...e, pattern: e.pattern })),
        ...FINPAY_RULES.sharedKernel,
        FINPAY_RULES.ui,
        ...FINPAY_RULES.domain.map(e => ({ ...e, pattern: e.pattern })),
        FINPAY_RULES.infra,
      ],
    },
  },
  {
    rules: {
      "boundaries/element-types": [2, {
        default: "disallow",
        rules: [
          // Apps importam de shared, domain, ui
          { from: "app", allow: ["shared", "domain", "ui"] },
          // Shared importa de shared
          { from: "shared", allow: ["shared"] },
          // UI importa de shared
          { from: "ui", allow: ["shared"] },
          // Domain importa de shared
          { from: "domain", allow: ["shared"] },
          // Auth pode importar db
          { from: "domain", allow: ["domain"], elementName: ["packages/auth"], allowedElementNames: ["packages/db"] },
          // Infra importa de qualquer um
          { from: "infra", allow: ["shared", "domain", "ui", "app"] },
        ],
      }],
    },
  },
];
```

## 3. Configuração dependency-cruiser

```javascript
// .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    // Regra 1: Sem circulares
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },

    // Regra 2: Sem cross-app imports
    {
      name: "no-cross-app-imports",
      severity: "error",
      comment: "Apps não podem importar de outras apps",
      from: { path: "^apps/[^/]+" },
      to: { path: "^apps/[^/]+", pathNot: "^apps/\\1" },
    },

    // Regra 3: Packages não importam apps
    {
      name: "packages-must-not-import-apps",
      severity: "error",
      comment: "Packages não dependem de apps",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },

    // Regra 4: UI isolado do domínio
    {
      name: "ui-must-not-depend-on-domain",
      severity: "error",
      comment: "UI não depende de db, auth, observability",
      from: { path: "packages/ui" },
      to: {
        path: ["packages/db", "packages/auth", "packages/observability"],
      },
    },

    // Regra 5: Contracts é shared kernel
    {
      name: "contracts-is-shared-kernel",
      severity: "warn",
      comment: "Contracts não deve ter dependências de domínio",
      from: { path: "packages/contracts" },
      to: {
        path: ["packages/db", "packages/auth", "packages/observability"],
      },
    },

    // Regra 6: Validation é shared kernel
    {
      name: "validation-is-shared-kernel",
      severity: "warn",
      comment: "Validation não deve ter dependências de domínio",
      from: { path: "packages/validation" },
      to: {
        path: ["packages/db", "packages/auth", "packages/observability"],
      },
    },

    // Regra 7: Observability é conformist (pode ler tudo)
    {
      name: "observability-is-conformist",
      severity: "info",
      comment: "Observability pode importar de qualquer package",
      from: { path: "packages/observability" },
      to: {},
    },

    // Regra 8: Test helpers podem importar qualquer um
    {
      name: "test-helpers-can-import-all",
      severity: "info",
      comment: "Test helpers são infraestrutura",
      from: { path: "packages/test-helpers" },
      to: {},
    },
  ],

  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.base.json",
    },
  },
};
```

## 4. Importações Permitidas - Tabela Completa

| De \ Para | contracts | validation | ui | db | auth | observability | sdk | test-helpers | apps/* |
|-----------|-----------|------------|-----|-----|------|---------------|-----|--------------|--------|
| **contracts** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **validation** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **ui** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **db** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **auth** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **observability** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **sdk** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **test-helpers** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **apps/web** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **apps/api** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

## 5. Scripts de Validação

### Verificar limites

```bash
#!/bin/bash
# scripts/check-boundaries.sh

echo "A verificar limites de pacotes..."

# Dependency-cruiser com regras de boundary
npx depcruise packages/ apps/ --config .dependency-cruiser.cjs --output-type text

if [ $? -ne 0 ]; then
  echo "ERRO: Violações de limites encontradas"
  exit 1
fi

echo "OK - Limites respeitados"
```

### Verificar imports cross-app

```bash
#!/bin/bash
# scripts/check-cross-app.sh

echo "A verificar importações cross-app..."

# Procurar imports relativos que cruzam limites
CROSS=$(grep -r "from.*\.\./\.\." packages/*/src/ apps/*/src/ --include="*.ts" --include="*.tsx" -l 2>/dev/null)

if [ -n "$CROSS" ]; then
  echo "ERRO: Importações relativas cross-package:"
  echo "$CROSS"
  exit 1
fi

echo "OK - Sem importações cross-package"
```

### Verificar PrismaClient

```bash
#!/bin/bash
# scripts/check-prisma-client.sh

echo "A verificar PrismaClient..."

BAD=$(grep -r "new PrismaClient\|PrismaClient(" packages/*/src/ apps/*/src/ --include="*.ts" -l 2>/dev/null | grep -v "packages/db/")

if [ -n "$BAD" ]; then
  echo "ERRO: PrismaClient encontrado fora de @finpay/db:"
  echo "$BAD"
  echo "Usar: import { db } from '@finpay/db'"
  exit 1
fi

echo "OK - PrismaClient isolado em @finpay/db"
```
