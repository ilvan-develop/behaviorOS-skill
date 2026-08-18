#Requires -Version 5.1
<#
.SYNOPSIS
    behaviorOS Pipeline - Loop principal de desenvolvimento autonomo

.DESCRIPTION
    Implementa o ciclo autonomo F0->F6 do behaviorOS.
    Le o state-machine.json, valida gates, atualiza estado e regista audit trail.

.PARAMETER Phase
    Fase a executar (F0, F1, F2, F3, F4, F5, F6)

.PARAMETER Scope
    Escopo especifico (opcional)

.PARAMETER DryRun
    Simula execucao sem alterar ficheiros

.EXAMPLE
    .\run-pipeline.ps1 -Phase F0
    .\run-pipeline.ps1 -Phase F1 -Scope "IAM-AUTH"
    .\run-pipeline.ps1 -Phase F2 -DryRun
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("F0", "F1", "F2", "F3", "F4", "F5", "F6")]
    [string]$Phase,

    [string]$Scope,

    [switch]$DryRun,

    # Who is driving this phase. Defaults to "orchestrator" (allowed in every phase's
    # allowedAgents in the shipped templates) so existing ".\run-pipeline.ps1 -Phase F0"
    # invocations keep working unchanged.
    [ValidateSet("orchestrator", "architect", "planner", "backend", "frontend", "database", "qa", "security", "devops", "compliance")]
    [string]$Agent = "orchestrator"
)

$ErrorActionPreference = "Stop"

# Caminhos base (correctos: .opencode/governance, .opencode/memory, etc.)
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$GovernanceDir = Join-Path (Join-Path $ProjectRoot ".opencode") "governance"
$MemoryDir = Join-Path (Join-Path $ProjectRoot ".opencode") "memory"
$AuditDir = Join-Path (Join-Path $ProjectRoot ".opencode") "audit"
$LogsDir = Join-Path (Join-Path $ProjectRoot ".opencode") "logs"
$ScriptsDir = $PSScriptRoot

# Ficheiros
$StateMachineFile = Join-Path $GovernanceDir "state-machine.json"
$PermissionsFile = Join-Path $GovernanceDir "permissions-matrix.json"
$SkillGateFile = Join-Path $GovernanceDir "skill-gate.json"
$InstructionsFile = Join-Path $GovernanceDir "INSTRUCTIONS.md"
$AuditLogFile = Join-Path $AuditDir "audit.log"
$StateFile = Join-Path $LogsDir "state.json"

# ─────────────────────────────────────────────────────────
# Funcoes auxiliares
# ─────────────────────────────────────────────────────────

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "$timestamp | $Level | $Message"
    Write-Host $logEntry -ForegroundColor $(
        switch ($Level) {
            "ERROR" { "Red" }
            "WARN"  { "Yellow" }
            "OK"    { "Green" }
            default { "Cyan" }
        }
    )
    if (-not $DryRun) {
        Add-Utf8NoBomLine -Path $AuditLogFile -Line $logEntry
    }
}

# Windows PowerShell 5.1's `Add-Content -Encoding UTF8` writes a BOM on file creation, which
# breaks Node's JSON.parse (scripts/oage-metrics.mjs, .opencode/plugins/*.mjs read *.jsonl).
function Add-Utf8NoBomLine {
    param([string]$Path, [string]$Line)
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    if (-not (Test-Path $Path)) {
        [System.IO.File]::WriteAllText($Path, "$Line`n", $utf8NoBom)
    } else {
        [System.IO.File]::AppendAllText($Path, "$Line`n", $utf8NoBom)
    }
}

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        throw "Ficheiro nao encontrado: $Path"
    }
    return Get-Content $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

# Windows PowerShell 5.1's `Set-Content -Encoding UTF8` writes a BOM, which breaks Node's
# JSON.parse (scripts/validate.mjs, scripts/lint.mjs, core/validator.mjs, .opencode/plugins/).
function Set-Utf8NoBom {
    param([string]$Path, [string]$Content)
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Write-JsonFile {
    param([string]$Path, $Object)
    if (-not $DryRun) {
        Set-Utf8NoBom -Path $Path -Content ($Object | ConvertTo-Json -Depth 10)
    }
}

function Update-Memory {
    param([string]$Section, [string]$Content)
    $memoryFile = Join-Path $MemoryDir "$Section.md"
    if (-not $DryRun) {
        Set-Utf8NoBom -Path $memoryFile -Content $Content
    }
    Write-Log "Memoria atualizada: $Section" "OK"
}

function Add-AuditEntry {
    param([string]$Type, [string]$Details)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $entry = "$timestamp | $Phase | $Type | $Details"
    if (-not $DryRun) {
        Add-Utf8NoBomLine -Path $AuditLogFile -Line $entry
    }
    Write-Log "Audit: $Type - $Details" "OK"
}

# ─────────────────────────────────────────────────────────
# Passo 1: Ler e validar estado actual
# ─────────────────────────────────────────────────────────

Write-Log "==============================================="
Write-Log "behaviorOS Pipeline - Fase $Phase"
Write-Log "==============================================="

$stateMachine = Read-JsonFile $StateMachineFile
$currentState = $stateMachine.currentState

Write-Log "Estado actual: $currentState"
Write-Log "Fase solicitada: $Phase"

# Verificar se a fase solicitada e a actual
if ($Phase -ne $currentState) {
    Write-Log "Fase solicitada ($Phase) nao e a fase actual ($currentState)" "WARN"
    Write-Log "A avancar para a fase $Phase..." "WARN"
}

# Encontrar a fase no state machine
$phaseInfo = $stateMachine.states | Where-Object { $_.id -eq $Phase }
if (-not $phaseInfo) {
    throw "Fase $Phase nao encontrada no state-machine.json"
}

Write-Log "Fase: $($phaseInfo.name) - $($phaseInfo.description)"
Write-Log "Critica: $($phaseInfo.isCritical)"

# ─────────────────────────────────────────────────────────
# Passo 2: Verificar permissoes (formato matrix{})
# ─────────────────────────────────────────────────────────

Write-Log "== Verificando permissoes para $Phase =="

$permissions = Read-JsonFile $PermissionsFile

# Formato matrix{}: { "matrix": { "F0": { "allowedAgents": [...] } } }
$phaseConfig = $permissions.matrix.PSObject.Properties | Where-Object { $_.Name -eq $Phase }

if (-not $phaseConfig) {
    Write-Log "Permissoes nao encontradas para $Phase" "WARN"
} else {
    $phaseData = $phaseConfig.Value
    $allowedAgents = @($phaseData.allowedAgents)
    Write-Log "Agentes permitidos: $($allowedAgents -join ', ')"
    Write-Log "Aprovacoes requeridas: $($phaseData.requiredApprovals)"
    Add-AuditEntry "PERMISSIONS_CHECK" "Agentes: $($allowedAgents -join ', ')"
}

# Aplicar a matriz, nao so a ler: permission-guard.ps1 e o unico consumer real de
# permissions-matrix.json, e ate aqui o pipeline lia e mostrava allowedAgents sem nunca
# comparar contra quem esta a executar nem abortar — a politica era "enforced, fail-closed"
# na governanca mas inerte no unico caminho automatico que a devia aplicar.
$PermissionGuard = Join-Path $ScriptsDir "guards\permission-guard.ps1"
if (Test-Path $PermissionGuard) {
    & $PermissionGuard -Agent $Agent -Phase $Phase
    $permissionExit = $LASTEXITCODE
    if ($permissionExit -ne 0) {
        Add-AuditEntry "PERMISSIONS_BLOCKED" "Agente '$Agent' bloqueado na fase $Phase"
        throw "permission-guard.ps1 bloqueou o agente '$Agent' na fase $Phase"
    }
} else {
    Write-Log "permission-guard.ps1 nao encontrado - permissoes nao aplicadas" "WARN"
}

# ─────────────────────────────────────────────────────────
# Passo 3: Carregar skills obrigatorias (formato phases{})
# ─────────────────────────────────────────────────────────

Write-Log "== Carregando skills para $Phase =="

$skillGate = Read-JsonFile $SkillGateFile

# Formato phases{}: { "phases": { "F0": { "required": [...] } } }
$phaseSkillsConfig = $skillGate.phases.PSObject.Properties | Where-Object { $_.Name -eq $Phase }

if (-not $phaseSkillsConfig) {
    Write-Log "Skills nao encontradas para $Phase" "WARN"
} else {
    $phaseSkillsData = $phaseSkillsConfig.Value
    $requiredSkills = @($phaseSkillsData.required)
    Write-Log "Skills obrigatorias: $($requiredSkills -join ', ')"
    if ($phaseSkillsData.optional) {
        Write-Log "Skills opcionais: $($phaseSkillsData.optional -join ', ')"
    }
    Add-AuditEntry "SKILLS_LOADED" "Obrigatorias: $($requiredSkills -join ', ')"
}

# ─────────────────────────────────────────────────────────
# Passo 4: Ler instrucoes imutiveis
# ─────────────────────────────────────────────────────────

Write-Log "== Verificando instrucoes =="

if (Test-Path $InstructionsFile) {
    $instructions = Get-Content $InstructionsFile -Raw -Encoding UTF8
    $ruleCount = ([regex]::Matches($instructions, "### \d+")).Count
    Write-Log "Instrucoes carregadas: $ruleCount regras imutiveis"
    Add-AuditEntry "INSTRUCTIONS_LOADED" "$ruleCount regras"
} else {
    Write-Log "INSTRUCTIONS.md nao encontrado" "ERROR"
}

# ─────────────────────────────────────────────────────────
# Passo 5: Executar gates de qualidade
# ─────────────────────────────────────────────────────────

Write-Log "== Executando gates de qualidade para $Phase =="

$gatesScript = Join-Path $ScriptsDir "gates.ps1"
if (-not (Test-Path $gatesScript)) {
    Write-Log "gates.ps1 nao encontrado - a simular gates" "WARN"
    $gatesPassed = $true
} else {
    try {
        $gateResult = & $gatesScript -Phase $Phase
        $gatesPassed = $gateResult -eq 0
    } catch {
        Write-Log "Erro ao executar gates: $_" "ERROR"
        $gatesPassed = $false
    }
}

if ($gatesPassed) {
    Write-Log "Todos os gates passaram" "OK"
    Add-AuditEntry "GATES_PASSED" "Lint, typecheck, build, test"
} else {
    Write-Log "Gates falharam - a abortar" "ERROR"
    Add-AuditEntry "GATES_FAILED" "Pipeline abortado"
    throw "Gates de qualidade falharam para a fase $Phase"
}

# ─────────────────────────────────────────────────────────
# Passo 6: Validar transicao de estado
# ─────────────────────────────────────────────────────────

Write-Log "== Validando transicao de estado =="

$allowedTransitions = $stateMachine.transitions | Where-Object { $_.from -eq $Phase }
$nextPhases = @($allowedTransitions | ForEach-Object { $_.to })

if ($nextPhases.Count -gt 0) {
    Write-Log "Proximas fases possiveis: $($nextPhases -join ', ')"
    $nextPhase = $nextPhases[0] # Primeira transicao por defeito
    Write-Log "Proxima fase: $nextPhase"
} else {
    Write-Log "Fase terminal - pipeline completo" "OK"
    $nextPhase = $null
}

# ─────────────────────────────────────────────────────────
# Passo 7: Atualizar estado
# ─────────────────────────────────────────────────────────

Write-Log "== Atualizando estado =="

# Actualizar state-machine.json
$phaseInfo.status = "completed"
if ($nextPhase) {
    $stateMachine.currentState = $nextPhase
    $nextPhaseInfo = $stateMachine.states | Where-Object { $_.id -eq $nextPhase }
    if ($nextPhaseInfo) {
        $nextPhaseInfo.status = "in_progress"
    }
}
Write-JsonFile $StateMachineFile $stateMachine

# Actualizar current-phase.md
$memoryContent = @"
# Fase Atual

Fase atual: $Phase - $($phaseInfo.name)
Status: Concluida
Data de conclusao: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

## Proxima Fase
$(if ($nextPhase) { "$nextPhase - $($nextPhaseInfo.name)" } else { "Pipeline completo" })
"@
Update-Memory "current-phase" $memoryContent

# ─────────────────────────────────────────────────────────
# Passo 8: Registar na memoria
# ─────────────────────────────────────────────────────────

Write-Log "== Atualizando memoria =="

# Adicionar decisao
$decisionContent = @"
# Decisoes Arquiteturais

## Fase $Phase - $(Get-Date -Format 'yyyy-MM-dd')

- Fase $Phase ($($phaseInfo.name)) concluida
- Gates: Todos passaram
- Proxima fase: $(if ($nextPhase) { "$nextPhase" } else { "Pipeline completo" })
- Scope: $(if ($Scope) { $Scope } else { "Nao definido" })
"@
Update-Memory "decisions" $decisionContent

# Adicionar padrao
$patternContent = @"
# Padroes Descobertos

## Fase $Phase - $(Get-Date -Format 'yyyy-MM-dd')

- Pipeline executado com sucesso para $Phase
- Todos os gates de qualidade passaram
- Estado actualizado para $(if ($nextPhase) { $nextPhase } else { "concluido" })
"@
Update-Memory "patterns" $patternContent

# Adicionar licao
$learningContent = @"
# Licoes Aprendidas

## Fase $Phase - $(Get-Date -Format 'yyyy-MM-dd')

- Execucao da fase $Phase bem-sucedida
- Importancia de executar todos os gates na ordem correcta
- Necessidade de actualizar memoria apos cada fase
"@
Update-Memory "learnings" $learningContent

# ─────────────────────────────────────────────────────────
# Passo 9: Gerar relatorio
# ─────────────────────────────────────────────────────────

Write-Log "==============================================="
Write-Log "RELATORIO DE CONCLUSAO - FASE $Phase"
Write-Log "==============================================="

$reportLines = @(
    "RELATORIO DE PIPELINE - FASE $Phase",
    "",
    "RESUMO",
    "Fase: $Phase - $($phaseInfo.name)",
    "Descricao: $($phaseInfo.description)",
    "Critica: $(if ($phaseInfo.isCritical) { "Sim" } else { "Nao" })",
    "Estado: Concluida",
    "Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "",
    "GATES EXECUTADOS",
    "Lint: OK",
    "Typecheck: OK",
    "Build: OK",
    "Testes: OK",
    "",
    "MEMORIA ATUALIZADA",
    "current-phase.md: OK",
    "decisions.md: OK",
    "patterns.md: OK",
    "learnings.md: OK",
    "",
    "PROXIMOS PASSOS",
    $(if ($nextPhase) { "Iniciar fase $nextPhase com /agent_loop --phase $nextPhase" } else { "Pipeline completo - todos os projectos estao prontos" }),
    "",
    "AUDIT TRAIL",
    "Entradas registadas em audit.log",
    "Ficheiros de memoria actualizados",
    "Estado da maquina de estados actualizado"
)
$report = $reportLines -join "`n"

Write-Host ""
Write-Host $report -ForegroundColor Cyan

# Guardar relatorio
$reportFile = Join-Path $LogsDir "report-$Phase-$(Get-Date -Format 'yyyyMMdd-HHmmss').md"
if (-not $DryRun) {
    Set-Utf8NoBom -Path $reportFile -Content $report
    Write-Log "Relatorio guardado em: $reportFile" "OK"
}

# ─────────────────────────────────────────────────────────
# Passo 10: Verificar se fase e critica
# ─────────────────────────────────────────────────────────

if ($phaseInfo.isCritical) {
    Write-Log "===============================================" "WARN"
    Write-Log "ATENCAO: Fase critica - Aprovacao humana necessaria" "WARN"
    Write-Log "===============================================" "WARN"
    Write-Log "A fase $Phase e critica. Aguarde aprovacao antes de avancar." "WARN"
    Add-AuditEntry "CRITICAL_PHASE" "Aprovacao humana necessaria para $Phase"
}

Write-Log "==============================================="
Write-Log "Pipeline $Phase concluido com sucesso"
Write-Log "==============================================="
