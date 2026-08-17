# Anti-Patterns Monorepo - Catálogo Alargado

Referência completa de anti-patterns monorepo para o projeto FinPay.

## Categorias

### Estrutura de Pacotes

| ID | Anti-Pattern | Severidade | Correção |
|----|-------------|------------|----------|
| AP-S01 | Pacote com PrismaClient próprio | Crítico | Usar proxy `@finpay/db` |
| AP-S02 | App importa de outro App | Crítico | Extrair lógica para `packages/` |
| AP-S03 | Utils como dumping ground | Alto | Criar pacotes específicos (`@finpay/formatters`) |
| AP-S04 | Package count excessivo (>5:1 programador) | Médio | Consolidar, extrair apenas após 3+ instâncias |
| AP-S05 | Pacote sem README | Médio | Documentar propósito e uso |

### Dependências

| ID | Anti-Pattern | Severidade | Correção |
|----|-------------|------------|----------|
| AP-D01 | Versão duplicada da mesma lib | Crítico | Catálogo pnpm `catalogMode: strict` |
| AP-D02 | Dependência em devDependencies usada em runtime | Alto | Mover para `dependencies` |
| AP-D03 | `@types/node` acima da versão runtime | Alto | Alinhar com Node.js LTS |
| AP-D04 | Override de segurança ausente | Crítico | Configurar `catalog.overrides` |
| AP-D05 | Dependência não catalogada | Alto | Adicionar ao `pnpm-workspace.yaml` |

### Importações

| ID | Anti-Pattern | Severidade | Correção |
|----|-------------|------------|----------|
| AP-I01 | Importação relativa cross-package | Crítico | Importar pelo nome `@finpay/*` |
| AP-I02 | Importar shadcn diretamente | Alto | Usar `@finpay/ui` |
| AP-I03 | App importa de `packages/` privado | Alto | Usar contratos `@finpay/contracts` |
| AP-I04 | `packages/` importa de `apps/` | Crítico | Inverter dependência |
| AP-I05 | Circulares entre packages | Crítico | Refatorar para dependency injection |

### Build e CI

| ID | Anti-Pattern | Severidade | Correção |
|----|-------------|------------|----------|
| AP-B01 | CI sem affected detection | Alto | `turbo build --filter=...[origin/main]` |
| AP-B02 | Docker image monolítica | Alto | `turbo prune` + imagens por serviço |
| AP-B03 | Cache não configurado | Médio | Ativar Turborepo remote cache |
| AP-B04 | Build completo em cada PR | Alto | Filtrar apenas pacotes alterados |
| AP-B05 | Sem pre-commit hooks | Alto | Husky + madge + sherif |

### Configuração

| ID | Anti-Pattern | Severidade | Correção |
|----|-------------|------------|----------|
| AP-C01 | tsconfig duplicado por app | Médio | `tsconfig.base.json` partilhado |
| AP-C02 | Dois sistemas de logging | Alto | Fonte única `@finpay/observability` |
| AP-C03 | Config de lint duplicada | Médio | Config partilhado na raiz |
| AP-C04 | Biome config diferente por pacote | Médio | `biome.json` na raiz |

### Governança

| ID | Anti-Pattern | Severidade | Correção |
|----|-------------|------------|----------|
| AP-G01 | Sem CODEOWNERS | Alto | Definir dono por diretoria |
| AP-G02 | Sem ADRs | Médio | Documentar decisões em `docs/adr/` |
| AP-G03 | Sem fitness functions | Alto | Scripts automatizados de verificação |
| AP-G04 | Dependências circulares no main | Crítico | Bloquear no CI |
| AP-G05 | Prisma schema sem validação | Crítico | Gate de aprovação para `*.prisma` |

### Segurança no Monorepo

| ID | Anti-Pattern | Severidade | Correção |
|----|-------------|------------|----------|
| AP-SE01 | Secrets hardcoded em packages | Crítico | Usar variáveis de ambiente |
| AP-SE02 | Tenant isolation não verificada | Crítico | Gate `organizationId` obrigatório |
| AP-SE03 | PCI-DSS card data em logs | Crítico | Bloquear padrão no tool-gate |
| AP-SE04 | SQL injection via template literals | Crítico | Usar Prisma query builder |

## Comandos de Verificação

```bash
# Verificar todos os anti-patterns de uma vez
bash scripts/fitness-check.sh

# Verificar apenas circulares
npx madge --circular --ts-config ./tsconfig.base.json --extensions ts packages/ apps/

# Verificar apenas deriva
npx sherif

# Verificar PrismaClient
grep -r "new PrismaClient" packages/*/src/ apps/*/src/ --include="*.ts" -l | grep -v "packages/db/"

# Verificar importações shadcn
grep -r "from.*@/components/ui" packages/*/src/ apps/*/src/ --include="*.ts" --include="*.tsx" -l

# Verificar dependências hardcoded
find packages apps -name "package.json" -not -path "*/node_modules/*" -exec grep -l '"[^"]*": "\^[0-9]' {} \;
```
