#Requires -Version 5.1
<#
.SYNOPSIS
    behaviorOS State Guard - Valida transições de estado

.DESCRIPTION
    Verifica se a fase atual é válida e se a transição é permitida.
    Lê state-machine.json para validação.

.PARAMETER Phase
    Fase que está sendo executada (F0, F1, F2, F3, F4, F5, F6)

.EXAMPLE
    .\state-guard.ps1 -Phase "F1"
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("F0", "F1", "F2", "F3", "F4", "F5", "F6")]
    [string]$Phase
)

$ErrorActionPreference = "Stop"

# Encontrar raiz do projeto
$ProjectRoot = (Get-Location).Path
$GovernanceDir = Join-Path $ProjectRoot ".opencode" "governance"
$StateMachineFile = Join-Path $GovernanceDir "state-machine.json"

# Verificar se state-machine.json existe
if (-not (Test-Path $StateMachineFile)) {
    Write-Host "[WARN] state-machine.json não encontrado - permitindo ação" -ForegroundColor Yellow
    exit 0
}

# Ler state-machine.json
try {
    $stateMachine = Get-Content $StateMachineFile -Raw | ConvertFrom-Json
} catch {
    Write-Host "[ERROR] Erro ao ler state-machine.json: $_" -ForegroundColor Red
    exit 1
}

# Obter estado atual
$currentState = $stateMachine.currentState

# Verificar se a fase solicitada é a fase atual
if ($Phase -ne $currentState) {
    Write-Host "[BLOCKED] Fase $Phase não é a fase atual ($currentState)" -ForegroundColor Red
    
    # Verificar se a transição é permitida
    $allowedTransitions = $stateMachine.transitions | Where-Object { $_.from -eq $currentState }
    $allowedPhases = @($allowedTransitions | ForEach-Object { $_.to })
    
    if ($Phase -in $allowedPhases) {
        Write-Host "   Transição permitida: $currentState -> $Phase" -ForegroundColor Yellow
        Write-Host "   Mas a fase atual ainda é $currentState" -ForegroundColor Yellow
    } else {
        Write-Host "   Transições permitidas de ${currentState}: $($allowedPhases -join ', ')" -ForegroundColor Yellow
    }
    
    # Registrar no audit
    $auditScript = Join-Path $PSScriptRoot ".." "audit-logger.ps1"
    if (Test-Path $auditScript) {
        & $auditScript -Tool "state" -File "phase-$Phase" -Agent "unknown" -Phase $Phase -Result "BLOCKED" -Gate "state" -Message "Not current phase"
    }
    
    exit 1
}

# Verificar se a fase existe
$phaseInfo = $stateMachine.states | Where-Object { $_.id -eq $Phase }
if (-not $phaseInfo) {
    Write-Host "[BLOCKED] Fase $Phase não encontrada no state-machine" -ForegroundColor Red
    
    # Registrar no audit
    $auditScript = Join-Path $PSScriptRoot ".." "audit-logger.ps1"
    if (Test-Path $auditScript) {
        & $auditScript -Tool "state" -File "phase-$Phase" -Agent "unknown" -Phase $Phase -Result "BLOCKED" -Gate "state" -Message "Phase not found"
    }
    
    exit 1
}

# Verificar se a fase está bloqueada (falhou anteriormente)
if ($phaseInfo.status -eq "failed") {
    Write-Host "[BLOCKED] Fase $Phase está em estado 'failed'" -ForegroundColor Red
    Write-Host "   Resetar a fase antes de tentar novamente" -ForegroundColor Yellow
    
    # Registrar no audit
    $auditScript = Join-Path $PSScriptRoot ".." "audit-logger.ps1"
    if (Test-Path $auditScript) {
        & $auditScript -Tool "state" -File "phase-$Phase" -Agent "unknown" -Phase $Phase -Result "BLOCKED" -Gate "state" -Message "Phase in failed state"
    }
    
    exit 1
}

# Verificar se a fase é crítica e requer aprovação
if ($phaseInfo.isCritical -and $phaseInfo.status -eq "pending") {
    Write-Host "[ASK] Fase crítica $Phase - requer aprovação humana" -ForegroundColor Yellow
    
    # Registrar no audit
    $auditScript = Join-Path $PSScriptRoot ".." "audit-logger.ps1"
    if (Test-Path $auditScript) {
        & $auditScript -Tool "state" -File "phase-$Phase" -Agent "unknown" -Phase $Phase -Result "ASK" -Gate "state" -Message "Critical phase requires approval"
    }
    
    # Por agora, permitir (em implementação futura, pausar para aprovação)
    Write-Host "   [PERMITIDO] Continuando..." -ForegroundColor Green
}

Write-Host "[PASS] Fase $Phase é a fase atual" -ForegroundColor Green
exit 0
