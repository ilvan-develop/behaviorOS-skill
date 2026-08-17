---
name: monorepo-architecture-guardian
description: Governança de arquitetura monorepo para workspaces pnpm + Turborepo. Use quando validar limites de pacotes, detetar dependências circulares, verificar deriva de dependências, auditar consistência do catálogo, validar arquitetura de pacotes, ou impor anti-patterns de monorepo. Carregar antes de cada tarefa relacionada ao monorepo.
metadata:
  stack: pnpm, turborepo, typescript
  scope: monorepo-governance
  version: "1.0.0"
---

# Monorepo Architecture Guardian - Enterprise Governance Guide

## 1. Visão Geral

Esta skill é a camada de governança do monorepo FinPay. Enquanto a skill `turbo` trata da configuração do Turborepo (tasks, cache, filtering), esta skill valida a **estrutura arquitetónica** do workspace.

**Carregar esta skill quando:**
- Criar, mover ou eliminar um pacote
- Adicionar uma dependência a qualquer `package.json`
- Revisar PRs que afetam a estrutura do monorepo
- Configurar CI/CD com gates de qualidade
- Auditar o estado atual do workspace
- Implementar novos bounded contexts

**Não carregar quando:**
- Apenas alterar lógica dentro de um pacote existente
- Configurar Turborepo tasks/cache (usar skill `turbo`)
- Trabalhar em código de aplicação (apps/web, apps/api)

---

## 2. Validação de Arquitetura

### 2.1 Layout Esperado

```
finpay/
├── apps/
│   ├── web/              # Next.js 16 - Dashboard
│   ├── api/              # NestJS 11 + oRPC - API
│   ├── ocr-worker/       # Python FastAPI + Tesseract
│   └── qa/               # Suites E2E/contrato
├── packages/
│   ├── contracts/        # Zod + oRPC contracts (shared kernel)
│   ├── db/               # Prisma 7 client + schema
│   ├── auth/             # Better Auth server + client
│   ├── ui/               # shadcn/ui + design system
│   ├── validation/       # Zod schemas de env
│   ├── observability/    # Audit types + metrics
│   ├── sdk/              # Public TypeScript SDK
│   └── test-helpers/     # Shared test mocks/fixtures
├── docs/
├── .github/workflows/
└── turbo.json
```

### 2.2 Convenções de Nomes

| Regra | Correto | Incorreto |
|-------|---------|-----------|
| Escopo obrigatório | `@finpay/ui` | `finpay-ui`, `ui` |
| Apps sem escopo `@finpay/` | `web`, `api` | `@finpay/web` |
| Nomes descritivos | `@finpay/contracts` | `@finpay/utils`, `@finpay/shared` |
| Hifenização | `test-helpers` | `testHelpers`, `test_helpers` |

### 2.3 Regras apps vs packages

| Aspecto | `apps/` | `packages/` |
|---------|---------|-------------|
| Publicável | Não | Sim (`@finpay/*`) |
| Dependências de outros apps | Nunca | Sim |
| Próprio `package.json` | Sim | Sim |
| Pode importar de `packages/` | Sim | Sim |
| Pode importar de outro `apps/` | **Nunca** | **Nunca** |

### 2.4 Verificação de Estrutura

```bash
# Verificar que todo pacote em apps/ e packages/ tem package.json
find apps packages -maxdepth 2 -name "package.json" -not -path "*/node_modules/*" | sort

# Verificar que nenhum pacote tem PrismaClient próprio
grep -r "PrismaClient" packages/*/src/ apps/*/src/ --include="*.ts" -l
# Resultado esperado: apenas packages/db/src/
```

---

## 3. Anti-Patterns

> **Nota:** Regras cross-cutting (tenant isolation, audit trail, secrets, design tokens) estão centralizadas em `enterprise-governance`. Esta secção documenta apenas anti-patterns específicos do monorepo.

### AP-01: Pacote cria PrismaClient próprio

```typescript
// MAU - Qualquer pacote que não seja @finpay/db
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// BOM - Usar sempre o proxy @finpay/db
import { db } from '@finpay/db';
```

**Regra:** Apenas `packages/db/` pode instanciar `PrismaClient`. Todos os outros pacotes importam de `@finpay/db`.

### AP-02: Importar shadcn diretamente

```typescript
// MAU - Importar componente shadcn diretamente
import { Button } from '@/components/ui/button';

// BOM - Usar sempre @finpay/ui
import { Button } from '@finpay/ui';
```

**Regra:** Nunca importar shadcn diretamente. Sempre via `@finpay/ui`.

### AP-03: App importa de outro App

```typescript
// MAU - apps/web importa de apps/api
import { validatePayment } from '../../api/src/payments/service';

// BOM - Extrair lógica partilhada para packages/
import { validatePayment } from '@finpay/contracts';
```

**Regra:** Apps dependem apenas de `packages/`, nunca de outros apps.

### AP-04: Dependência em devDependencies mas usada em runtime

```json
// MAU
{
  "devDependencies": {
    "@tanstack/react-query": "^5.0.0"
  }
}

// BOM
{
  "dependencies": {
    "@tanstack/react-query": "^5.0.0"
  }
}
```

### AP-05: Duas versões da mesma dependência

```json
// MAU - packages/web e packages/api com versões diferentes
// packages/web/package.json
{ "vitest": "^3.0.0" }
// packages/api/package.json
{ "vitest": "^2.1.0" }

// BOM - Catálogo pnpm com versão única
// pnpm-workspace.yaml
catalog:
  vitest: ^3.0.5
```

### AP-06: Dois loggers diferentes

```typescript
// MAU - Dois sistemas de logging
import pino from 'pino';           // em packages/observability
import { Logger } from '@nestjs/common'; // em apps/api

// BOM - Fonte única de logging via @finpay/observability
import { createLogger } from '@finpay/observability';
```

### AP-07: Configurações duplicadas por app

```json
// MAU - Cada app com seu próprio tsconfig.json completo
// apps/web/tsconfig.json (40 linhas)
// apps/api/tsconfig.json (40 linhas)

// BOM - tsconfig.base.json partilhado
// tsconfig.base.json na raiz, cada app estende dele
```

### AP-08: Utils como dumping ground

```typescript
// MAU - packages/utils/ com 500+ ficheiros sem dono
export const formatDate = () => {};
export const parseXML = () => {};
export const calculateTax = () => {};

// BOM - Pacotes específicos com dono
// @finpay/formatters, @finpay/validators, @finpay/tax
```

### AP-09: Package count excessivo para a equipa

```
# MAU - 25 pacotes para 3 programadores (razão > 5:1)
packages/
├── button/
├── card/
├── modal/
├── input/
├── select/
├── ... (20 mais)

# BOM - 3-5 pacotes iniciais, extrair quando necessário
packages/
├── ui/          # Todos os componentes
├── contracts/   # Todos os schemas
├── db/          # Database layer
└── validation/  # Validação partilhada
```

**Regra:** Extrair um novo pacote apenas após 3+ instâncias de código similar serem identificadas.

### AP-10: Docker image monolítica

```dockerfile
# MAU - Uma imagem com tudo
FROM node:24
COPY . .
RUN pnpm install

# BOM - Imagens por serviço com turbo prune
RUN turbo prune api --docker
```

### AP-11: Sem CODEOWNERS

```
# MAU - Sem ficheiro .github/CODEOWNERS
# BOM - Cada diretoria de pacote com dono
/packages/ui/          @team/design-system
/packages/db/          @team/platform
/apps/web/             @team/web
```

### AP-12: CI sem affected detection

```yaml
# MAU - Build completo em cada PR
- run: pnpm turbo build

# BOM - Apenas pacotes afetados
- run: pnpm turbo build --filter=...[origin/main]
```

---

## 4. Imposição de Limites

### 4.1 Configuração eslint-plugin-boundaries

```javascript
// eslint.config.mjs
import boundaries from "eslint-plugin-boundaries";

export default [
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        // Apps - não podem ser importados por ninguém
        { type: "app", pattern: "apps/*" },
        // Shared kernel - qualquer pacote pode importar
        { type: "shared", pattern: "packages/contracts" },
        { type: "shared", pattern: "packages/validation" },
        { type: "shared", pattern: "packages/ui" },
        // Domain packages - dependência dirigida
        { type: "domain", pattern: "packages/db" },
        { type: "domain", pattern: "packages/auth" },
        { type: "domain", pattern: "packages/observability" },
        { type: "domain", pattern: "packages/sdk" },
        // Infrastructure
        { type: "infra", pattern: "packages/test-helpers" },
      ],
    },
  },
  {
    rules: {
      "boundaries/element-types": [2, {
        default: "disallow",
        rules: [
          // Apps podem importar de shared e domain
          { from: "app", allow: ["shared", "domain"] },
          // Shared pode importar de shared
          { from: "shared", allow: ["shared"] },
          // Domain pode importar de shared
          { from: "domain", allow: ["shared"] },
          // Test helpers podem importar de qualquer um
          { from: "infra", allow: ["shared", "domain", "app"] },
        ],
      }],
    },
  },
];
```

### 4.2 Regras de Importação FinPay

| De | Para | Permitido |
|----|------|-----------|
| `apps/*` | `packages/*` | Sim |
| `apps/web` | `apps/api` | **Não** |
| `apps/api` | `apps/web` | **Não** |
| `packages/ui` | `packages/db` | **Não** |
| `packages/db` | `packages/ui` | **Não** |
| `packages/contracts` | `packages/*` | Sim (shared kernel) |
| `packages/*` | `packages/contracts` | Sim |
| `packages/*` | `apps/*` | **Não** |

### 4.3 Importações Relativas Proibidas

```typescript
// MAU - Importação relativa que cruza limites
import { something } from '../../other-package/src/module';

// BOM - Importar pelo nome registado
import { something } from '@finpay/other-package';
```

**Ferramenta:** `eslint-plugin-monorepo-guard` para detetar importações relativas cross-package.

### 4.4 Bounded Contexts FinPay

```
IAM ──────► Payments, Billing, Tenants, Webhooks
Tenants ──► Payments, Billing, Webhooks
Payments ─► Money Movement, Compliance & Audit
Billing ──► Money Movement
Webhooks ─► Notifications
Compliance & Audit ──► (todos - Conformist)
Observability ──► (todos - Separate Ways)
```

Cada contexto:
- Possui a sua própria persistência (nunca aceder a tabelas de outro contexto)
- É independentemente deployável
- Comunica via contratos (`@finpay/contracts`)

---

## 5. Dependências Circulares

### 5.1 Deteção com madge

```bash
# Instalar
pnpm add -Dw madge

# Detetar circulares em todos os packages
npx madge --circular --ts-config ./tsconfig.base.json --extensions ts packages/

# Detetar circulares em todos os apps
npx madge --circular --ts-config ./tsconfig.base.json --extensions ts apps/

# Gerar grafo visual
npx madge packages/ --image graph.svg

# Encontrar módulos órfãos (sem dependentes)
npx madge --orphans packages/
```

### 5.2 Deteção com dependency-cruiser

```javascript
// .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-cross-app-imports",
      severity: "error",
      from: { path: "^apps/[^/]+" },
      to: { path: "^apps/[^/]+", pathNot: "^apps/\\1" },
    },
    {
      name: "packages-must-not-import-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "ui-must-not-depend-on-db",
      severity: "error",
      from: { path: "packages/ui" },
      to: { path: "packages/db" },
    },
  ],
};
```

```bash
# Instalar
pnpm add -Dw dependency-cruiser

# Analisar
npx depcruise packages/ apps/ --config .dependency-cruiser.cjs

# Gerar grafo de alto nível
npx depcruise --config .dependency-cruiser.cjs --output-type archi packages/ | dot -T svg > dependency-graph.svg
```

### 5.3 Script CI de Verificação

```bash
#!/bin/bash
# scripts/check-circular.sh

echo "A verificar dependências circulares..."

# Madge
MADGE_OUTPUT=$(npx madge --circular --ts-config ./tsconfig.base.json --extensions ts packages/ apps/ 2>&1)
if [ $? -ne 0 ]; then
  echo "ERRO: Dependências circulares detetadas:"
  echo "$MADGE_OUTPUT"
  exit 1
fi

# Dependency-cruiser
npx depcruise packages/ apps/ --config .dependency-cruiser.cjs
if [ $? -ne 0 ]; then
  echo "ERRO: Violações de dependências encontradas"
  exit 1
fi

echo "OK - Sem dependências circulares"
```

### 5.4 Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
npx madge --circular --ts-config ./tsconfig.base.json --extensions ts packages/ apps/ || (echo "ERRO: Dependências circulares encontradas. Resolver antes de commitar." && exit 1)
```

---

## 6. Deriva de Dependências

### 6.1 Configuração do Catálogo pnpm

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"

catalogMode: strict

catalog:
  # Frameworks
  "next": ^16.3.0
  "@nestjs/core": ^11.1.24
  "@nestjs/common": ^11.1.24
  "react": ^19.2.0
  "react-dom": ^19.2.0

  # oRPC
  "@orpc/contract": ^1.14.10
  "@orpc/server": ^1.14.10
  "@orpc/client": ^1.14.10

  # Database
  "@prisma/client": ^6.12.0
  "prisma": ^6.12.0

  # Auth
  "better-auth": ^1.3.0

  # UI
  "@radix-ui/react-dialog": ^1.1.0
  "class-variance-authority": ^0.7.0
  "clsx": ^2.1.0
  "tailwind-merge": ^3.0.0

  # Testing
  "vitest": ^3.0.5
  "@playwright/test": ^1.55.0
  "@testing-library/react": ^16.0.0

  # Quality
  "@biomejs/biome": ^2.5.4
  "typescript": ^5.8.0
  "turbo": ^2.9.18

  # Security overrides
  "multer": ^2.0.0
  "sharp": ^0.34.0
```

### 6.2 Uso nos Pacotes

```json
// BOM - packages/ui/package.json
{
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:",
    "@biomejs/biome": "catalog:"
  }
}
```

### 6.3 Deteção de Discrepâncias

```bash
# Instalar sherif
pnpm add -Dw sherif

# Verificar versões inconsistentes
npx sherif

# Output esperado se tudo OK:
# ✓ No issues found

# Output se houver problemas:
# ✗ packages/web/package.json: react@^18.3.0 (expected catalog: ^19.2.0)
```

### 6.4 Script de Verificação

```bash
#!/bin/bash
# scripts/check-drift.sh

echo "A verificar deriva de dependências..."

# Sherif - verifica consistência
npx sherif
if [ $? -ne 0 ]; then
  echo "ERRO: Discrepâncias de versão encontradas"
  exit 1
fi

# Verificar que catalog: é usado em vez de versões hardcoded
UNCOVERED=$(find packages apps -name "package.json" -not -path "*/node_modules/*" \
  -exec grep -l '"[^"]*": "\^[0-9]' {} \; 2>/dev/null)

if [ -n "$UNCOVERED" ]; then
  echo "AVISO: Ficheiros package.json com versões hardcoded (deviam usar catalog:):"
  echo "$UNCOVERED"
  exit 1
fi

echo "OK - Sem deriva de dependências"
```

### 6.5 Atualização Segura

```bash
# Atualizar todas as dependências via catálogo
# 1. Editar pnpm-workspace.yaml (atualizar versões no catalog)
# 2. Executar:
pnpm update -r

# Migrar para catalog (codemod automático)
pnpx codemod pnpm/catalog
```

---

## 7. Governança

### 7.1 CODEOWNERS

```
# .github/CODEOWNERS
# Cada diretoria de pacote com dono obrigatório

# Apps
/apps/web/             @team/web
/apps/api/             @team/backend
/apps/ocr-worker/      @team/platform
/apps/qa/              @team/qa

# Packages
/packages/contracts/   @team/backend
/packages/db/          @team/platform
/packages/auth/        @team/security
/packages/ui/          @team/design-system
/packages/validation/  @team/backend
/packages/observability/ @team/platform
/packages/sdk/         @team/backend
/packages/test-helpers/ @team/qa

# Configuração
/turbo.json            @team/platform
/pnpm-workspace.yaml   @team/platform
/tsconfig.base.json    @team/platform
/.github/              @team/platform
```

### 7.2 Architecture Decision Records (ADR)

Localização: `docs/adr/`

Estrutura:
```markdown
# ADR-0001: Usar pnpm + Turborepo para Monorepo

## Estado
Aceite

## Contexto
A equipa cresce de 5 para 15 engenheiros. 3 apps partilham tipos e uma UI library.
Discrepâncias de versão causam bugs em runtime.

## Decisão
Adotar pnpm workspaces com Turborepo 2.x para orquestração de builds,
e pnpm catalogs para gestão de versões.

## Alternativas Consideradas
- Nx: Mais funcionalidades mas mais complexidade
- Yarn workspaces: Sem feature de catalog
- Bazel: Excessivo para JS/TS

## Consequências
- Positivo: Deriva eliminada, CI 80% mais rápido
- Negativo: Equipa deve aprender pnpm catalogs
```

### 7.3 Fitness Functions

Verificações automatizadas que validam decisões arquitetónicas:

```bash
#!/bin/bash
# scripts/fitness-check.sh

echo "=== Fitness Functions - Monorepo ==="

# 1. Consistência de versões
echo "[1/5] Verificar consistência de versões..."
npx sherif || exit 1

# 2. Dependências circulares
echo "[2/5] Verificar dependências circulares..."
npx madge --circular --ts-config ./tsconfig.base.json --extensions ts packages/ || exit 1

# 3. Limite de pacotes
echo "[3/5] Verificar limite de pacotes..."
PKG_COUNT=$(find packages -maxdepth 1 -mindepth 1 -type d | wc -l)
if [ "$PKG_COUNT" -gt 15 ]; then
  echo "ERRO: $PKG_COUNT pacotes (máximo 15)"
  exit 1
fi
echo "  $PKG_COUNT pacotes (OK)"

# 4. Próprio PrismaClient
echo "[4/5] Verificar PrismaClient..."
BAD_CLIENTS=$(grep -r "new PrismaClient" packages/*/src/ apps/*/src/ --include="*.ts" -l 2>/dev/null | grep -v "packages/db/")
if [ -n "$BAD_CLIENTS" ]; then
  echo "ERRO: PrismaClient encontrado fora de @finpay/db:"
  echo "$BAD_CLIENTS"
  exit 1
fi
echo "  OK"

# 5. Importações shadcn diretas
echo "[5/5] Verificar importações shadcn diretas..."
BAD_IMPORTS=$(grep -r "from.*@/components/ui" packages/*/src/ apps/*/src/ --include="*.ts" --include="*.tsx" -l 2>/dev/null)
if [ -n "$BAD_IMPORTS" ]; then
  echo "ERRO: Importações shadcn diretas (deviam usar @finpay/ui):"
  echo "$BAD_IMPORTS"
  exit 1
fi
echo "  OK"

echo "=== Todas as fitness functions passaram ==="
```

### 7.4 Checklist de Governança

- [ ] CODEOWNERS definido para todos os pacotes
- [ ] ADRs documentadas para decisões arquitetónicas
- [ ] Regras de limites configuradas no ESLint
- [ ] Deteção de circulares no CI
- [ ] Catálogo pnpm com `catalogMode: strict`
- [ ] Naming `@finpay/*` em todos os packages
- [ ] README em cada pacote
- [ ] CONTRIBUTING.md com workflows monorepo
- [ ] Lockfile commitado
- [ ] Remote caching ativado

---

## 8. Integração CI

### 8.1 GitHub Actions

```yaml
# .github/workflows/monorepo-governance.yml
name: Monorepo Governance

on:
  pull_request:
    paths:
      - "packages/**"
      - "apps/**"
      - "pnpm-workspace.yaml"
      - "turbo.json"

jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - name: Verificar deriva de dependências
        run: npx sherif

      - name: Verificar dependências circulares
        run: npx madge --circular --ts-config ./tsconfig.base.json --extensions ts packages/ apps/

      - name: Verificar limites de importação
        run: npx depcruise packages/ apps/ --config .dependency-cruiser.cjs

      - name: Fitness functions
        run: bash scripts/fitness-check.sh

      - name: Verificar PrismaClient isolado
        run: |
          BAD=$(grep -r "new PrismaClient" packages/*/src/ apps/*/src/ --include="*.ts" -l 2>/dev/null | grep -v "packages/db/" || true)
          if [ -n "$BAD" ]; then
            echo "ERRO: PrismaClient fora de @finpay/db: $BAD"
            exit 1
          fi
```

### 8.2 Pre-commit Hook (Husky)

```bash
# .husky/pre-commit
#!/bin/sh
echo "A executar monorepo governance checks..."

# Dependências circulares
npx madge --circular --ts-config ./tsconfig.base.json --extensions ts packages/ apps/ 2>/dev/null
if [ $? -ne 0 ]; then
  echo "ERRO: Dependências circulares. Resolver antes de commitar."
  exit 1
fi

# Deriva de dependências
npx sherif 2>/dev/null
if [ $? -ne 0 ]; then
  echo "ERRO: Discrepâncias de versão. Usar catalog: nos package.json."
  exit 1
fi
```

### 8.3 Script de Gate de Qualidade

```bash
#!/bin/bash
# scripts/quality-gate.sh

set -e

echo "========================================="
echo "  Monorepo Quality Gate - FinPay"
echo "========================================="

ERRORS=0

# 1. Lint
echo "[1/6] Lint..."
pnpm turbo lint || ERRORS=$((ERRORS + 1))

# 2. Typecheck
echo "[2/6] Typecheck..."
pnpm turbo typecheck || ERRORS=$((ERRORS + 1))

# 3. Build
echo "[3/6] Build..."
pnpm turbo build || ERRORS=$((ERRORS + 1))

# 4. Testes unitários
echo "[4/6] Testes unitários..."
pnpm turbo test:unit || ERRORS=$((ERRORS + 1))

# 5. Governança monorepo
echo "[5/6] Governança monorepo..."
bash scripts/fitness-check.sh || ERRORS=$((ERRORS + 1))

# 6. Cobertura
echo "[6/6] Cobertura mínima..."
# Verificar se cobertura >= 80%
# (configurar conforme necessário)

echo "========================================="
if [ $ERRORS -gt 0 ]; then
  echo "FALHOU - $ERRORS erros encontrados"
  exit 1
else
  echo "PASSOU - Todos os checks OK"
fi
```

---

## Referências

- `enterprise-governance` - Regras cross-cutting (tenant isolation, audit trail, secrets, design tokens)
- `references/anti-patterns.md` - Catálogo alargado de anti-patterns com exemplos adicionais
- `references/boundary-rules.md` - Templates de config de limites para os 9 contextos
- Skill `turbo` - Configuração Turborepo (tasks, cache, filtering)
- Skill `biome` - Linting e formatação
- `blueprint/01-STACK-MONOREPO.md` - Stack planejada
- `blueprint/02-ARQUITETURA-CONTRATOS.md` - Bounded contexts
- `blueprint/09-BEST-PRACTICES.md` - Melhores práticas
