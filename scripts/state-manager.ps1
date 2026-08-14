#Requires -Version 5.1
<#
.SYNOPSIS
    behaviorOS State Manager - Gerenciamento de estado do pipeline

.DESCRIPTION
    Le, escreve e valida o estado do pipeline.

.PARAMETER Action
    Accao a executar: get, set, validate, list, reset

.PARAMETER Phase
    Fase a configurar (quando Action = set)

.PARAMETER Status
    Estado da fase (quando Action = set): pending, in_progress, completed, failed

.EXAMPLE
    .\state-manager.ps1 -Action get
    .\state-manager.ps1 -Action set -Phase F1 -Status in_progress
    .\state-manager.ps1 -Action validate -Phase F2
    .\state-manager.ps1 -Action list
    .\state-manager.ps1 -Action reset
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("get", "set", "validate", "list", "reset")]
    [string]$Action,

    [string]$Phase,

    [ValidateSet("pending", "in_progress", "completed", "failed")]
    [string]$Status
)

$ErrorActionPreference = "Stop"

# Caminhos
$BaseDir = Split-Path -Parent $PSScriptRoot
$GovernanceDir = Join-Path $BaseDir "governance"
$MemoryDir = Join-Path $BaseDir "memory"
$LogsDir = Join-Path $BaseDir "logs"
$AuditDir = Join-Path $BaseDir "audit"

$StateMachineFile = Join-Path $GovernanceDir "state-machine.json"
$StateFile = Join-Path $LogsDir "state.json"
$AuditLogFile = Join-Path $AuditDir "audit.log"

# Funcoes auxiliares
function Read-StateMachine {
    if (-not (Test-Path $StateMachineFile)) {
        throw "state-machine.json nao encontrado: $StateMachineFile"
    }
    return Get-Content $StateMachineFile -Raw | ConvertFrom-Json
}

function Write-StateMachine {
    param($Object)
    $Object | ConvertTo-Json -Depth 10 | Set-Content $StateMachineFile
}

function Read-State {
    if (-not (Test-Path $StateFile)) {
        return @{
            currentPhase = "F0"
            lastUpdate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
            history = @()
        }
    }
    return Get-Content $StateFile -Raw | ConvertFrom-Json
}

function Write-State {
    param($Object)
    if (-not (Test-Path $LogsDir)) {
        New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
    }
    $Object | ConvertTo-Json -Depth 10 | Set-Content $StateFile
}

function Add-AuditEntry {
    param([string]$ActionType, [string]$Details)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $entry = "$timestamp | STATE | $ActionType | $Details"
    if (Test-Path $AuditLogFile) {
        Add-Content -Path $AuditLogFile -Value $entry
    }
}

# Accao: GET - Obter estado actual
if ($Action -eq "get") {
    $stateMachine = Read-StateMachine
    $state = Read-State

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "ESTADO ACTUAL DO PIPELINE" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "Fase actual: $($stateMachine.currentState)" -ForegroundColor Green

    $currentPhaseInfo = $stateMachine.states | Where-Object { $_.id -eq $stateMachine.currentState }
    if ($currentPhaseInfo) {
        Write-Host "Nome: $($currentPhaseInfo.name)" -ForegroundColor Gray
        Write-Host "Descricao: $($currentPhaseInfo.description)" -ForegroundColor Gray
        $critica = if ($currentPhaseInfo.isCritical) { "Sim" } else { "Nao" }
        Write-Host "Critica: $critica" -ForegroundColor Gray
        Write-Host "Estado: $($currentPhaseInfo.status)" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "Ultima actualizacao: $($state.lastUpdate)" -ForegroundColor Gray

    Add-AuditEntry "GET" "Estado actual: $($stateMachine.currentState)"
}

# Accao: SET - Actualizar estado
if ($Action -eq "set") {
    if (-not $Phase) {
        throw "Parametro -Phase e obrigatorio para accao 'set'"
    }
    if (-not $Status) {
        throw "Parametro -Status e obrigatorio para accao 'set'"
    }

    $stateMachine = Read-StateMachine
    $state = Read-State

    $phaseInfo = $stateMachine.states | Where-Object { $_.id -eq $Phase }
    if (-not $phaseInfo) {
        throw "Fase $Phase nao encontrada no state-machine.json"
    }

    $oldStatus = $phaseInfo.status
    $phaseInfo.status = $Status

    if ($Status -eq "in_progress") {
        $stateMachine.currentState = $Phase
    }

    Write-StateMachine $stateMachine

    $state.lastUpdate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    $state.currentPhase = $Phase

    if (-not $state.history) {
        $state.history = @()
    }
    $state.history += @{
        timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        phase = $Phase
        action = "status_change"
        oldStatus = $oldStatus
        newStatus = $Status
    }

    if ($state.history.Count -gt 50) {
        $state.history = $state.history[-50..-1]
    }

    Write-State $state

    Write-Host "[OK] Fase $Phase actualizada: $oldStatus -> $Status" -ForegroundColor Green
    $auditMsg = "Fase " + $Phase + ": " + $oldStatus + " -> " + $Status
    Add-AuditEntry "SET" $auditMsg
}

# Accao: VALIDATE - Validar transicao
if ($Action -eq "validate") {
    if (-not $Phase) {
        throw "Parametro -Phase e obrigatorio para accao 'validate'"
    }

    $stateMachine = Read-StateMachine
    $currentState = $stateMachine.currentState

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "VALIDACAO DE TRANSICAO" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "Estado actual: $currentState" -ForegroundColor Gray
    Write-Host "Fase solicitada: $Phase" -ForegroundColor Gray

    $allowedTransitions = $stateMachine.transitions | Where-Object { $_.from -eq $currentState }
    $allowedPhases = @($allowedTransitions | ForEach-Object { $_.to })

    if ($allowedPhases -contains $Phase) {
        Write-Host "[OK] Transicao permitida: $currentState -> $Phase" -ForegroundColor Green
        Add-AuditEntry "VALIDATE" "Transicao permitida: $currentState -> $Phase"
    } else {
        Write-Host "[FAIL] Transicao nao permitida: $currentState -> $Phase" -ForegroundColor Red
        Write-Host "   Transicoes permitidas: $($allowedPhases -join ', ')" -ForegroundColor Yellow
        Add-AuditEntry "VALIDATE" "Transicao nao permitida: $currentState -> $Phase"
        exit 1
    }

    $targetPhase = $stateMachine.states | Where-Object { $_.id -eq $Phase }
    if (-not $targetPhase) {
        Write-Host "[FAIL] Fase $Phase nao encontrada" -ForegroundColor Red
        exit 1
    }

    Write-Host "   Fase: $($targetPhase.name)" -ForegroundColor Gray
    $critica = if ($targetPhase.isCritical) { "Sim (requer aprovacao)" } else { "Nao" }
    Write-Host "   Critica: $critica" -ForegroundColor Gray
}

# Accao: LIST - Listar todas as fases
if ($Action -eq "list") {
    $stateMachine = Read-StateMachine

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "TODAS AS FASES DO PIPELINE" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    foreach ($state in $stateMachine.states) {
        $isCurrent = $state.id -eq $stateMachine.currentState
        $icon = if ($isCurrent) { ">" } else { " " }
        $color = if ($isCurrent) { "Green" } elseif ($state.status -eq "completed") { "Gray" } else { "White" }

        $statusIcon = switch ($state.status) {
            "pending" { "o" }
            "in_progress" { "*" }
            "completed" { "v" }
            "failed" { "x" }
        }

        Write-Host "$icon $($state.id) - $($state.name)" -ForegroundColor $color
        Write-Host "  $statusIcon $($state.description)" -ForegroundColor Gray
        $critica = if ($state.isCritical) { "Sim" } else { "Nao" }
        Write-Host "  Critica: $critica" -ForegroundColor Gray
        Write-Host ""
    }

    Add-AuditEntry "LIST" "Lista de fases mostrada"
}

# Accao: RESET - Resetar estado
if ($Action -eq "reset") {
    $stateMachine = Read-StateMachine

    foreach ($state in $stateMachine.states) {
        $state.status = "pending"
    }

    $stateMachine.currentState = "F0"

    Write-StateMachine $stateMachine

    $state = @{
        currentPhase = "F0"
        lastUpdate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        history = @()
    }
    Write-State $state

    $memoryFiles = @("decisions.md", "patterns.md", "learnings.md", "current-phase.md", "compliance.md")
    foreach ($file in $memoryFiles) {
        $memoryFile = Join-Path $MemoryDir $file
        if (Test-Path $memoryFile) {
            $content = switch ($file) {
                "current-phase.md" { "# Fase Atual`n`nFase atual: F0 - Fundacao`nStatus: Pendente`n" }
                default { "# Conteudo`n`nConteudo vazio.`n" }
            }
            Set-Content -Path $memoryFile -Value $content
        }
    }

    Set-Content -Path $AuditLogFile -Value ""

    Write-Host "[OK] Estado resetado com sucesso" -ForegroundColor Green
    Add-AuditEntry "RESET" "Estado resetado para F0"
}
