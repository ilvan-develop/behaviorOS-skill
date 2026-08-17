#Requires -Version 5.1
<#
.SYNOPSIS
    behaviorOS Agent Loop - Orquestrador principal multi-fase

.DESCRIPTION
    Ciclo autono completo F0->F6. Le state-machine.json, valida gates,
    delega para agentes, atualiza estado e regista audit trail.
    Diferente de run-pipeline.ps1 (que executa UMA fase), este script
    roda o ciclo completo ou retoma de uma fase especifica.

.PARAMETER Phase
    Fase especifica a executar (F0-F6). Se omitido, usa currentState.

.PARAMETER Scope
    Escopo especifico (ex: "F2-PAYMENTS")

.PARAMETER Reset
    Resetar estado. Valores:
    - "all" ou "F0": reset completo para F0
    - "F1"-"F6": resetar essa fase e todas as downstream

.PARAMETER Resume
    Retomar de onde parou (currentState)

.PARAMETER DryRun
    Simula execucao sem alterar ficheiros

.PARAMETER Parallel
    Executar F2+F3 em paralelo quando possivel

.EXAMPLE
    .\agent-loop.ps1                          # Retoma de currentState
    .\agent-loop.ps1 -Phase F1                # Executa so F1
    .\agent-loop.ps1 -Phase F2 -Scope "PAYMENTS"
    .\agent-loop.ps1 -Reset "all"             # Reseta tudo para F0
    .\agent-loop.ps1 -Reset "F1"              # Reseta F1 e downstream
    .\agent-loop.ps1 -Resume                  # Retoma pipeline
    .\agent-loop.ps1 -DryRun                  # Simula sem alterar
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("F0", "F1", "F2", "F3", "F4", "F5", "F6")]
    [string]$Phase,

    [string]$Scope,

    [ValidateSet("all", "F0", "F1", "F2", "F3", "F4", "F5", "F6")]
    [string]$Reset,

    [switch]$Resume,

    [switch]$DryRun,

    [switch]$Parallel
)

$ErrorActionPreference = "Stop"

# ========================================
# Caminhos base
# ========================================

$ScriptsDir = $PSScriptRoot
$ProjectRoot = Split-Path -Parent $ScriptsDir
$GovernanceDir = Join-Path (Join-Path $ProjectRoot ".opencode") "governance"
$MemoryDir = Join-Path (Join-Path $ProjectRoot ".opencode") "memory"
$AuditDir = Join-Path (Join-Path $ProjectRoot ".opencode") "audit"
$LogsDir = Join-Path (Join-Path $ProjectRoot ".opencode") "logs"

# Ficheiros
$StateMachineFile = Join-Path $GovernanceDir "state-machine.json"
$SkillGateFile = Join-Path $GovernanceDir "skill-gate.json"
$PermissionsFile = Join-Path $GovernanceDir "permissions-matrix.json"
$InstructionsFile = Join-Path $GovernanceDir "INSTRUCTIONS.md"
$AuditLogFile = Join-Path $AuditDir "audit.log"
$AuditJsonlFile = Join-Path $AuditDir "audit.jsonl"
$StateFile = Join-Path $LogsDir "state.json"

# Scripts auxiliares
$EnforceScript = Join-Path $ScriptsDir "enforce.ps1"
$SkillTrackerScript = Join-Path $ScriptsDir "skill-tracker.ps1"
$StateMgrScript = Join-Path $ScriptsDir "state-manager.ps1"
$GatesScript = Join-Path $ScriptsDir "gates.ps1"

# Fases criticas (requerem aprovacao humana)
$CriticalPhases = @("F2", "F3", "F5", "F6")

# ========================================
# Funcoes auxiliares
# ========================================

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "$timestamp | $Level | $Message"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN"  { "Yellow" }
        "OK"    { "Green" }
        "BLOCK" { "Magenta" }
        default { "Cyan" }
    }
    Write-Host $logEntry -ForegroundColor $color
    if (-not $DryRun -and (Test-Path $AuditLogFile)) {
        try { Add-Utf8NoBomLine -Path $AuditLogFile -Line $logEntry } catch { }
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

function Write-Jsonl {
    param([string]$Path, $Object)
    if (-not $DryRun) {
        $json = $Object | ConvertTo-Json -Compress
        try { Add-Utf8NoBomLine -Path $Path -Line $json } catch { }
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

function Get-DownstreamPhases {
    param([string]$FromPhase, $Transitions)
    $downstream = @()
    $queue = @($FromPhase)
    $visited = @{}

    while ($queue.Count -gt 0) {
        $current = $queue[0]
        $queue = $queue[1..($queue.Count-1)]

        if ($visited[$current]) { continue }
        $visited[$current] = $true

        $nextPhases = @($Transitions | Where-Object { $_.from -eq $current } | ForEach-Object { $_.to })
        foreach ($next in $nextPhases) {
            if (-not $visited[$next]) {
                $downstream += $next
                $queue += $next
            }
        }
    }

    return $downstream
}

function Update-Memory {
    param([string]$Section, [string]$Content)
    if (-not $DryRun) {
        $memoryFile = Join-Path $MemoryDir "$Section.md"
        try { Set-Utf8NoBom -Path $memoryFile -Content $Content } catch { }
    }
}

# ========================================
# PASSO 0: Validar ficheiros obrigatorios
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "behaviorOS Agent Loop" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $StateMachineFile)) {
    Write-Log "state-machine.json nao encontrado: $StateMachineFile" "ERROR"
    exit 1
}

$stateMachine = Read-JsonFile $StateMachineFile

# ========================================
# PASSO 1: Se -Reset, executar reset e sair
# ========================================

if ($Reset) {
    Write-Log "RESET Solicitado: $Reset"

    if ($Reset -eq "all" -or $Reset -eq "F0") {
        # Reset completo
        Write-Log "Reset completo para F0" "WARN"
        foreach ($state in $stateMachine.states) {
            $state.status = "pending"
        }
        $stateMachine.currentState = "F0"
        Write-JsonFile $StateMachineFile $stateMachine

        # Reset state.json
        $resetState = @{
            currentPhase = "F0"
            lastUpdate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
            history = @()
        }
        if (-not (Test-Path $LogsDir)) {
            New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
        }
        Write-JsonFile $StateFile $resetState

        # Limpar memoria
        $memoryFiles = @("decisions.md", "patterns.md", "learnings.md", "current-phase.md", "compliance.md")
        foreach ($file in $memoryFiles) {
            $memoryFile = Join-Path $MemoryDir $file
            if (Test-Path $memoryFile) {
                $content = switch ($file) {
                    "current-phase.md" { "# Fase Atual`n`nFase atual: F0 - Fundacao`nStatus: Pendente`n" }
                    default { "# Conteudo`n`nConteudo vazio.`n" }
                }
                if (-not $DryRun) {
                    Set-Utf8NoBom -Path $memoryFile -Content $content
                }
            }
        }

        Write-Log "Reset completo finalizado" "OK"
        Write-Host ""
        Write-Host "Estado resetado para F0. Execute:" -ForegroundColor Green
        Write-Host "  .\agent-loop.ps1 -Phase F0" -ForegroundColor Yellow
        exit 0

    } else {
        # Reset seletivo: fase especifica e downstream
        $targetPhase = $Reset
        $phaseExists = $stateMachine.states | Where-Object { $_.id -eq $targetPhase }
        if (-not $phaseExists) {
            Write-Log "Fase $targetPhase nao encontrada" "ERROR"
            exit 1
        }

        $downstream = Get-DownstreamPhases -FromPhase $targetPhase -Transitions $stateMachine.transitions
        $phasesToReset = @($targetPhase) + $downstream

        Write-Log "Resetando fases: $($phasesToReset -join ', ')" "WARN"

        foreach ($state in $stateMachine.states) {
            if ($state.id -in $phasesToReset) {
                $state.status = "pending"
            }
        }
        $stateMachine.currentState = $targetPhase
        Write-JsonFile $StateMachineFile $stateMachine

        # Colocar target phase como in_progress
        $targetInfo = $stateMachine.states | Where-Object { $_.id -eq $targetPhase }
        if ($targetInfo) {
            $targetInfo.status = "in_progress"
            Write-JsonFile $StateMachineFile $stateMachine
        }

        Write-Log "Reset de $targetPhase finalizado" "OK"
        Write-Host ""
        Write-Host "Fases resetadas: $($phasesToReset -join ', ')" -ForegroundColor Green
        Write-Host "Estado atual: $targetPhase (in_progress)" -ForegroundColor Green
        Write-Host ""
        Write-Host "Execute:" -ForegroundColor Yellow
        Write-Host "  .\agent-loop.ps1 -Phase $targetPhase" -ForegroundColor Yellow
        exit 0
    }
}

# ========================================
# PASSO 2: Determinar fase a executar
# ========================================

if ($Phase) {
    $startPhase = $Phase
} elseif ($Resume -or (-not $Phase)) {
    $startPhase = $stateMachine.currentState
}

Write-Log "Fase inicial: $startPhase"
Write-Log "Modo: $(if ($DryRun) { 'DryRun' } elseif ($Resume) { 'Resume' } else { 'Execucao' })"

# ========================================
# PASSO 3: Construir lista de fases a executar
# ========================================

$phaseOrder = @("F0", "F1", "F2", "F3", "F4", "F5", "F6")
$startIndex = [array]::IndexOf($phaseOrder, $startPhase)

if ($startIndex -eq -1) {
    Write-Log "Fase $startPhase invalida" "ERROR"
    exit 1
}

# Se e fase especifica, so executa essa
if ($Phase -and -not $Resume) {
    $phasesToRun = @($Phase)
} else {
    # Retoma: executa da fase atual em diante
    $phasesToRun = $phaseOrder[$startIndex..($phaseOrder.Count - 1)]
}

Write-Log "Fases a executar: $($phasesToRun -join ' -> ')"

# ========================================
# PASSO 4: Carregar configuracoes
# ========================================

$skillGate = if (Test-Path $SkillGateFile) { Read-JsonFile $SkillGateFile } else { $null }
$permissions = if (Test-Path $PermissionsFile) { Read-JsonFile $PermissionsFile } else { $null }

# ========================================
# LOOP PRINCIPAL: Executar cada fase
# ========================================

$totalPhases = $phasesToRun.Count
$completedPhases = 0
$failedPhases = @()

foreach ($currentPhase in $phasesToRun) {
    $completedPhases++

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "FASE $currentPhase ($completedPhases/$totalPhases)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    # Obter info da fase
    $phaseInfo = $stateMachine.states | Where-Object { $_.id -eq $currentPhase }
    if (-not $phaseInfo) {
        Write-Log "Fase $currentPhase nao encontrada no state-machine" "ERROR"
        $failedPhases += $currentPhase
        continue
    }

    Write-Log "Fase: $($phaseInfo.name) - $($phaseInfo.description)"
    $critica = if ($phaseInfo.isCritical) { "SIM" } else { "NAO" }
    Write-Log "Critica: $critica"

    # ----------------------------------------
    # 4.1 Validar transicao
    # ----------------------------------------

    Write-Log "-- Validando transicao para $currentPhase --"

    if ($currentPhase -ne "F0") {
        $allowedTransitions = $stateMachine.transitions | Where-Object { $_.from -eq $currentPhase }
        # Verificar se a fase anterior esta completed
        $prevPhaseIndex = [array]::IndexOf($phaseOrder, $currentPhase) - 1
        if ($prevPhaseIndex -ge 0) {
            $prevPhase = $phaseOrder[$prevPhaseIndex]
            $prevInfo = $stateMachine.states | Where-Object { $_.id -eq $prevPhase }
            if ($prevInfo -and $prevInfo.status -ne "completed") {
                Write-Log "Fase anterior ($prevPhase) nao esta completed: $($prevInfo.status)" "WARN"
                Write-Log "Transicao pode nao ser valida" "WARN"
            }
        }
    }

    # ----------------------------------------
    # 4.2 Carregar skills obrigatorias
    # ----------------------------------------

    Write-Log "-- Carregando skills para $currentPhase --"

    $requiredSkills = @()
    if ($skillGate -and $skillGate.phases) {
        $phaseSkills = $skillGate.phases.PSObject.Properties | Where-Object { $_.Name -eq $currentPhase }
        if ($phaseSkills) {
            $requiredSkills = @($phaseSkills.Value.required)
            Write-Log "Skills obrigatorias: $($requiredSkills -join ', ')"
        }
    }

    # Carregar cada skill via skill-tracker
    foreach ($skill in $requiredSkills) {
        if (Test-Path $SkillTrackerScript) {
            try {
                & $SkillTrackerScript -Skill $skill -Agent "orchestrator" -Phase $currentPhase -Action "load" 2>$null
            } catch {
                Write-Log "Aviso ao carregar skill ${skill}: ${_}" "WARN"
            }
        }
    }

    # ----------------------------------------
    # 4.3 Selecionar agentes
    # ----------------------------------------

    Write-Log "-- Selecionando agentes para $currentPhase --"

    $allowedAgents = @()
    if ($permissions -and $permissions.matrix) {
        $phasePerm = $permissions.matrix.PSObject.Properties | Where-Object { $_.Name -eq $currentPhase }
        if ($phasePerm -and $phasePerm.Value.allowedAgents) {
            $allowedAgents = @($phasePerm.Value.allowedAgents)
        }
    }

    if ($allowedAgents.Count -gt 0) {
        Write-Log "Agentes permitidos: $($allowedAgents -join ', ')"
    } else {
        Write-Log "Nenhuma regra de permissao para $currentPhase - usando default" "WARN"
        $allowedAgents = @("orchestrator", "backend", "frontend", "database", "qa")
    }

    # ----------------------------------------
    # 4.4 Delegar para agentes (fase de trabalho)
    # ----------------------------------------

    Write-Log "-- Executando fase $currentPhase --"
    Write-Log "Trabalho delegado para: $($allowedAgents -join ', ')"
    Write-Log "Scope: $(if ($Scope) { $Scope } else { "$currentPhase-TASK" })"

    # Atualizar estado para in_progress
    $phaseInfo.status = "in_progress"
    if (-not $DryRun) {
        $stateMachine.currentState = $currentPhase
        Write-JsonFile $StateMachineFile $stateMachine
    }

    # Registrar inicio
    Write-Jsonl -Path $AuditJsonlFile -Object @{
        timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        event = "phase_start"
        phase = $currentPhase
        agents = $allowedAgents
        skills = $requiredSkills
        scope = if ($Scope) { $Scope } else { "$currentPhase-TASK" }
    }

    # ----------------------------------------
    # NOTA: Aqui o orchestrator delegaria para agentes via
    # OpenCode Task tool. Como script PowerShell, apenas
    # reportamos o que seria feito. O agent real executa
    # via OpenCode CLI.
    # ----------------------------------------

    Write-Log ""
    Write-Log "=== INSTRUCOES PARA O ORCHESTRATOR ===" "WARN"
    Write-Log "Fase $currentPhase ($($phaseInfo.name)) pronta para execucao" "WARN"
    Write-Log "Agentes: $($allowedAgents -join ', ')" "WARN"
    Write-Log "Skills: $($requiredSkills -join ', ')" "WARN"
    Write-Log "Proximo: delegar tarefas e aguardar resultados" "WARN"
    Write-Log ""

    # ----------------------------------------
    # 4.5 Executar gates de qualidade
    # ----------------------------------------

    Write-Log "-- Executando gates para $currentPhase --"

    $gatesPassed = $true
    if (Test-Path $GatesScript) {
        try {
            & $GatesScript -Phase $currentPhase
            $gatesPassed = $LASTEXITCODE -eq 0
        } catch {
            Write-Log "Erro ao executar gates: $_" "ERROR"
            $gatesPassed = $false
        }
    } else {
        Write-Log "gates.ps1 nao encontrado - gates NAO executados" "ERROR"
        $gatesPassed = $false
    }

    if (-not $gatesPassed) {
        Write-Log "Gates falharam para $currentPhase" "ERROR"
        $phaseInfo.status = "failed"
        if (-not $DryRun) {
            Write-JsonFile $StateMachineFile $stateMachine
        }
        $failedPhases += $currentPhase

        Write-Jsonl -Path $AuditJsonlFile -Object @{
            timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
            event = "phase_failed"
            phase = $currentPhase
            reason = "gates_failed"
        }

        # Fases nao-criticas: continuar. Criticas: parar
        if ($currentPhase -in $CriticalPhases) {
            Write-Log "Fase critica falhou - pipeline abortado" "BLOCK"
            break
        } else {
            Write-Log "Fase nao-critica falhou - continuando proxima" "WARN"
            continue
        }
    }

    Write-Log "Gates passaram para $currentPhase" "OK"

    # ----------------------------------------
    # 4.6 Verificar se fase e critica
    # ----------------------------------------

    if ($currentPhase -in $CriticalPhases) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Magenta
        Write-Host "FASE CRITICA: $currentPhase - $($phaseInfo.name)" -ForegroundColor Magenta
        Write-Host "========================================" -ForegroundColor Magenta
        Write-Host "Requer aprovacao humana antes de avancar." -ForegroundColor Magenta
        Write-Host ""

        if (-not $DryRun) {
            $phaseInfo.status = "pending_approval"
            Write-JsonFile $StateMachineFile $stateMachine
        }

        Write-Jsonl -Path $AuditJsonlFile -Object @{
            timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
            event = "critical_phase"
            phase = $currentPhase
            status = "pending_approval"
        }

        Write-Log "Fase $currentPhase aguardando aprovacao" "BLOCK"

        # Se nao e DryRun, pausar para aprovacao
        if (-not $DryRun) {
            Write-Host ""
            Write-Host "Para aprovar e continuar:" -ForegroundColor Yellow
            Write-Host "  .\agent-loop.ps1 -Resume" -ForegroundColor Yellow
            Write-Host "Ou para rejeitar:" -ForegroundColor Yellow
            Write-Host "  .\state-manager.ps1 -Action set -Phase $currentPhase -Status failed" -ForegroundColor Yellow
            Write-Host ""

            # Em modo interativo, pausar
            if ($Host.UI.RawUI) {
                $response = Read-Host "Aprovar fase $currentPhase? (s/N)"
                if ($response -ne "s" -and $response -ne "S") {
                    Write-Log "Aprovacao negada para $currentPhase" "BLOCK"
                    $phaseInfo.status = "failed"
                    Write-JsonFile $StateMachineFile $stateMachine
                    $failedPhases += $currentPhase
                    break
                }
            }
        }
    }

    # ----------------------------------------
    # 4.7 Avancar estado
    # ----------------------------------------

    Write-Log "-- Avancando estado apos $currentPhase --"

    $phaseInfo.status = "completed"

    # Encontrar proxima fase
    $nextTransitions = $stateMachine.transitions | Where-Object { $_.from -eq $currentPhase }
    $nextPhases = @($nextTransitions | ForEach-Object { $_.to })

    if ($nextPhases.Count -gt 0) {
        $nextPhase = $nextPhases[0]
        Write-Log "Proxima fase: $nextPhase"

        $nextInfo = $stateMachine.states | Where-Object { $_.id -eq $nextPhase }
        if ($nextInfo) {
            $nextInfo.status = "in_progress"
        }

        if (-not $DryRun) {
            $stateMachine.currentState = $nextPhase
            Write-JsonFile $StateMachineFile $stateMachine
        }
    } else {
        Write-Log "Pipeline completo - todas as fases concluidas" "OK"
        if (-not $DryRun) {
            Write-JsonFile $StateMachineFile $stateMachine
        }
    }

    # ----------------------------------------
    # 4.8 Atualizar memoria
    # ----------------------------------------

    Write-Log "-- Atualizando memoria --"

    $currentPhaseMd = @"
# Fase Atual

Fase atual: $currentPhase - $($phaseInfo.name)
Status: Concluida
Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

## Proxima Fase
$(if ($nextPhases.Count -gt 0) { "$nextPhase" } else { "Pipeline completo" })
"@
    Update-Memory "current-phase" $currentPhaseMd

    # ----------------------------------------
    # 4.9 Registrar no audit
    # ----------------------------------------

    Write-Jsonl -Path $AuditJsonlFile -Object @{
        timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        event = "phase_complete"
        phase = $currentPhase
        gates = "passed"
        nextPhase = if ($nextPhases.Count -gt 0) { $nextPhase } else { "complete" }
    }

    Write-Log "Fase $currentPhase concluida com sucesso" "OK"
}

# ========================================
# RELATORIO FINAL
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RELATORIO DO AGENT LOOP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Resumo:" -ForegroundColor White
Write-Host "  Fases executadas: $completedPhases / $totalPhases" -ForegroundColor Gray
Write-Host "  Fases concluidas: $($completedPhases - $failedPhases.Count)" -ForegroundColor Green
Write-Host "  Fases com falha:  $($failedPhases.Count)" -ForegroundColor $(if ($failedPhases.Count -gt 0) { "Red" } else { "Green" })

if ($failedPhases.Count -gt 0) {
    Write-Host "  Falhas: $($failedPhases -join ', ')" -ForegroundColor Red
}

Write-Host ""
Write-Host "Estado actual:" -ForegroundColor White
Write-Host "  $($stateMachine.currentState)" -ForegroundColor Green

$currentInfo = $stateMachine.states | Where-Object { $_.id -eq $stateMachine.currentState }
if ($currentInfo) {
    Write-Host "  $($currentInfo.name) - $($currentInfo.description)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor White

if ($failedPhases.Count -gt 0) {
    Write-Host "  Corrigir falhas e repetir:" -ForegroundColor Yellow
    Write-Host "    .\agent-loop.ps1 -Phase $($failedPhases[0])" -ForegroundColor Yellow
} elseif ($stateMachine.currentState -ne "F6") {
    Write-Host "  Continuar pipeline:" -ForegroundColor Yellow
    Write-Host "    .\agent-loop.ps1 -Resume" -ForegroundColor Yellow
} else {
    Write-Host "  Pipeline completo!" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($failedPhases.Count -gt 0) {
    exit 1
} else {
    exit 0
}
