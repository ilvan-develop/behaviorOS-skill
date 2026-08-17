# Integração do behaviorOS num Projeto Existente

> Guia para adicionar governança behaviorOS (incluindo a camada de enforcement em runtime OAGE)
> a um projeto **já existente** — diferente de [GETTING-STARTED.md](GETTING-STARTED.md) e
> [QUICKSTART.md](QUICKSTART.md), que arrancam um projeto novo a partir de um template.

---

## 1. Quando usar este guia

Usa este guia quando já tens um repositório com código e queres:

- adicionar gates de governança (skill/tool/permission/state) sem recriar o projeto;
- activar **enforcement em runtime** (bloqueio automático, não apenas documentado) via
  `.opencode/plugins/`;
- ligar o teu pipeline de CI existente aos checks de política do behaviorOS;
- adoptar progressivamente as regras (começar em modo "ask"/observação antes de "deny").

Se estás a começar um projeto do zero, usa antes `node scripts/init.mjs` ou
`node scripts/install.mjs --template=<tipo>` (ver [GETTING-STARTED.md](GETTING-STARTED.md)).

---

## 2. Pré-requisitos

- Node.js 18+
- OpenCode instalado no projeto alvo
- Git (para os hooks de política funcionarem em commits/push)
- PowerShell 5.1+ se quiseres usar os scripts `.ps1` (opcional — os `.mjs` são
  multiplataforma e cobrem os gates novos)

---

## 3. Passo a passo

### 3.1 Copiar a governança para o projeto alvo

`scripts/install.mjs` instala sempre no directório onde é executado (`process.cwd()`) — não
aceita um caminho de destino como argumento. Entra primeiro no projeto alvo:

```bash
cd /caminho/para/o/teu-projeto

PROJECT_NAME="o-meu-projeto" PROJECT_DESCRIPTION="Descrição curta" \
  node /caminho/para/behaviorOS/scripts/install.mjs \
  --template=<fintech|saas-b2b|saas-b2c|ecommerce|marketplace|healthcare|education|custom>
```

Ou, a partir de um blueprint existente (`blueprint.json`):

```bash
cd /caminho/para/o/teu-projeto
node /caminho/para/behaviorOS/scripts/install.mjs --blueprint=/caminho/para/o/blueprint
```

`scripts/install.mjs` e `scripts/init.mjs` são wrappers finos de CLI sobre
`core/installer.mjs` — a única fonte de verdade do que é instalado. Isto garante que o que
sai por estes dois comandos é sempre o mesmo, incluindo os ficheiros abaixo.

Isto copia automaticamente, para `teu-projeto/`:

- `opencode.json` (raiz do projeto)
- `.opencode/governance/*` — incluindo os ficheiros partilhados entre templates
  (`anti-patterns.json`, `protected-resources.json`, `loop-detector.json`,
  `dependency-gate.json`, `truth-gate.json`, `reviewer-gate.json`, `mcp-registry.json`,
  `handoff-schema.json`, `definition-of-done.json`, `ci-gate.json`)
- `.opencode/plugins/` — `oage-enforce.js` (10 gates) e `oage-audit.js` (6 event types) (ver secção 4)
- `.opencode/commands/` — `/oage-doctor`, `/oage-audit`, `/oage-review`, `/oage-research`,
  `/oage-release`
- `.opencode/memory/`, `.opencode/skills/`
- `scripts/` — incluindo `audit-event.mjs`, `handoff.mjs`, `evidence-check.mjs`,
  `reviewer-check.mjs`, `oage-metrics.mjs`, `lint.mjs`
- `.github/workflows/oage-ci.yml`

Se já tens `opencode.json` no projeto, faz merge manual em vez de deixar sobrescrever —
o installer não faz merge automático de configuração existente.

### 3.2 Validar a instalação

```bash
cd /caminho/para/o/teu-projeto
node scripts/validate.mjs
node scripts/lint.mjs
```

Ambos devem terminar com exit code 0. `validate.mjs` confirma que os ficheiros de
governança existem e são JSON válido; `lint.mjs` corre scan de segredos e anti-patterns
críticos sobre o repositório inteiro.

### 3.3 Ajustar `opencode.json` ao teu contexto

Edita `agent`, `permission` e `governance.immutableRules` para reflectir o teu projeto real
— os valores copiados do template são um ponto de partida, não a verdade final. Presta
atenção especial a:

- `governance.criticalPhases` — quais fases do teu roadmap exigem aprovação humana
- `permission.bash` — comandos que devem ficar em `ask`/`deny` no teu contexto
- `agent.*.skills` — que skills cada agente carrega antes de trabalhar

### 3.4 Adoptar progressivamente (recomendado em código já existente)

Em código legado, activar todos os gates de imediato costuma gerar ruído. Sequência sugerida:

1. **Semana 1 — observar**: deixa `.opencode/plugins/oage-audit.js` a correr (regista tudo em
   `.opencode/audit/audit.jsonl`), mas revê `anti-patterns.json` e desliga (`"enabled": false`)
   qualquer categoria demasiado ruidosa para o teu código actual.
2. **Semana 2 — reforçar security/protected-resources**: estes dois quase nunca dão falsos
   positivos; mantém sempre activos (`protected-resources.json`, categoria `security` em
   `anti-patterns.json`).
3. **Semana 3+ — activar o resto**: `loop-detector.json`, `dependency-gate.json`,
   `truth-gate.json`, `reviewer-gate.json` à medida que a equipa se habitua ao fluxo.

---

## 4. Como o enforcement funciona em runtime

```
Agente pede um tool call (read/write/edit/bash)
        │
        ▼
.oage-enforce.js   (hook: tool.execute.before — 10 gates)
        │
        ├── 1. protected-resources.json  → nega leitura/escrita de .env, secrets/, chaves
        ├── 2. anti-patterns.json        → scan de regex ao conteúdo (write/edit) e ao comando (bash)
        ├── 3. dependency-gate.json      → exige evento 'dependency_justification' prévio
        ├── 4. truth-gate.json           → exige evento 'confidence_declared' >= limiar em ficheiros críticos
        ├── 5. loop-detector.json        → bloqueia repetição idêntica além do limite
        ├── 6. skill-gate-auto.json      → verifica se skill obrigatória foi carregada (write/edit)
        ├── 7. context7-gate.json        → exige consulta context7 recente (write/edit)
        ├── 8. tool-gate.json            → quality gates antes de git commit
        ├── 9. agent-loop flow           → avisa se escreve sem context7 + skill sequence
        └── 10. version-pinning-gate.json→ avisa se package.json não foi consultado
        │
        ▼ (se nada bloqueou)
   Tool call executa
        │
        ▼
.oage-audit.js      (hook: tool.execute.after — 6 event types)
        │
        ├── tool_executed    (toda tool call)
        ├── context7_queried (context7_resolve-library-id, context7_query-docs)
        ├── skill_load       (skill tool)
        ├── version_verified (read package.json)
        ├── confidence_declared (read *.prisma)
        └── quality_check    (bash: lint/typecheck/test/build)
```

Isto é diferente de `scripts/enforce.ps1` (que continua a existir): o `enforce.ps1` só corre
se o agente decidir chamá-lo (Regra 16 do `INSTRUCTIONS.md`). Os plugins em
`.opencode/plugins/` correm **sempre**, em cada tool call, porque são carregados pelo próprio
runtime do OpenCode — não dependem do agente cumprir uma instrução.

**Sem os plugins instalados, todos os ficheiros `.opencode/governance/*.json` são apenas
consultivos.** Confirma que existem com:

```bash
ls .opencode/plugins/
# esperado: oage-enforce.js  oage-audit.js  lib/
```

---

## 5. Fluxo diário com os novos scripts

| Situação | Comando |
|---|---|
| Vou instalar uma dependência nova | `node scripts/audit-event.mjs --event dependency_justification --agent <nome> --package <pkg> --why "<motivo>"` **antes** do `npm install`/`pnpm add` |
| Vou escrever num ficheiro crítico (schema, payment, auth) | `node scripts/audit-event.mjs --event confidence_declared --agent <nome> --phase <fase> --confidence <0-100>` antes de editar |
| Terminei uma fase e vou passar a outro agente | `node scripts/handoff.mjs --from <agente> --to <agente> --task "..." --context "..." --next-action "..."` |
| Uma fase crítica está pronta para fechar | `node scripts/audit-event.mjs --event review_approved --agent <revisor, diferente do implementador> --phase <fase> --reviewedBy <revisor>` |
| Vou marcar uma fase como `completed` | garantir `.opencode/evidence/<fase>.json` preenchido (ver `definition-of-done.json`) — `state-manager.ps1 -Action set -Status completed` valida isto automaticamente para fases críticas |
| Quero ver como o agente se está a comportar | `node scripts/oage-metrics.mjs` — taxa de bloqueio, taxa de violação de política, uso de context7, loops detectados |

---

## 6. Checklist de verificação pós-integração

```bash
node scripts/validate.mjs                 # ficheiros de governança presentes e válidos
node scripts/lint.mjs                      # segredos + anti-patterns críticos
node --test tests/*.test.js                # se estiveres a contribuir para o próprio behaviorOS
ls .opencode/plugins/                      # confirma que o enforcement em runtime está activo
ls .github/workflows/oage-ci.yml           # confirma que o CI vai revalidar tudo isto por fora
```

Ou, dentro de uma sessão OpenCode no projeto integrado, corre `/oage-doctor`.

---

## 7. Troubleshooting

**"Governance dir não encontrado"** — corre a partir da raiz do projeto alvo, não da raiz do
behaviorOS.

**Um write legítimo está a ser bloqueado** — verifica `.opencode/audit/audit.jsonl` pelo
evento `"event":"blocked"` mais recente; o campo `gate` diz qual ficheiro de política
disparou. Ajusta esse ficheiro (ex: adiciona um padrão a `exemptPatterns` em
`dependency-gate.json`) em vez de desactivar o plugin inteiro.

**`npm install` continua bloqueado depois de registar a justificação** — confirma que o
`--package`/comando usado no `dependency_justification` corresponde ao padrão em
`dependency-gate.json`; o gate lê o evento mais recente dentro da janela de 30 min.

**Quero desligar um gate específico temporariamente** — edita o `"enabled": false` no
ficheiro de política correspondente em `.opencode/governance/`, nunca apagues ou ignores o
plugin inteiro.

---

## 8. Referências

- [GETTING-STARTED.md](GETTING-STARTED.md) — arrancar um projeto novo a partir de um template
- [CUSTOMIZATION.md](CUSTOMIZATION.md) — personalizar regras e templates
- [TEMPLATES.md](TEMPLATES.md) — comparação entre os 8 templates
- `.opencode/governance/INSTRUCTIONS.md` — regras completas, incluindo as Regras OAGE 20-27
- `SKILL.md` — árvore completa do que fica instalado
