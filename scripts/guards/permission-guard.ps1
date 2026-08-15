#Requires -Version 5.1
<#
.SYNOPSIS
    behaviorOS Permission Guard - Valida permissões por fase

.DESCRIPTION
    Verifica se o agente tem permissão para executar ações na fase atual.
    Lê permissions-matrix.json para validação.

.PARAMETER Agent
    Nome do agente (backend, frontend, database, qa, security, devops, compliance, architect, planner, orchestrator)

.PARAMETER Phase
    Fase atual (F0, F1, F2, F3, F4, F5, F6)

.PARAMETER Action
    Ação pretendida (opcional, para validação mais granular)

.EXAMPLE
    .\permission-guard.ps1 -Agent "database" -Phase "F1"
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("orchestrator", "architect", "planner", "backend", "frontend", "database", "qa", "security", "devops", "compliance")]
    [string]$Agent,

    [Parameter(Mandatory=$true)]
    [ValidateSet("F0", "F1", "F2", "F3", "F4", "F5", "F6")]
    [string]$Phase,

    [Parameter(Mandatory=$false)]
    [string]$Action = ""
)

$ErrorActionPreference = "Stop"

# Encontrar raiz do projeto
$ProjectRoot = (Get-Location).Path
$GovernanceDir = Join-Path (Join-Path $ProjectRoot ".opencode") "governance"
$PermissionsFile = Join-Path $GovernanceDir "permissions-matrix.json"

# Verificar se permissions-matrix.json existe
if (-not (Test-Path $PermissionsFile)) {
    Write-Host "[WARN] permissions-matrix.json nao encontrado - permitindo acao" -ForegroundColor Yellow
    exit 0
}

# Ler permissions-matrix.json
try {
    $permissions = Get-Content $PermissionsFile -Raw | ConvertFrom-Json
} catch {
    Write-Host "[ERROR] Erro ao ler permissions-matrix.json: $_" -ForegroundColor Red
    exit 1
}

# Verificar se ha regras na matriz (formato matrix{})
if (-not $permissions.matrix) {
    Write-Host "[WARN] Nenhuma regra de matriz encontrada - permitindo acao" -ForegroundColor Yellow
    exit 0
}

# Encontrar configuracao da fase na matriz
$phaseConfig = $permissions.matrix.PSObject.Properties | Where-Object { $_.Name -eq $Phase }

if (-not $phaseConfig) {
    Write-Host "[WARN] Fase $Phase nao encontrada no permissions-matrix - permitindo acao" -ForegroundColor Yellow
    exit 0
}

# Obter a configuracao da fase
$phaseData = $phaseConfig.Value

# Verificar se o agente esta na lista de permitidos
$allowedAgents = @($phaseData.allowedAgents)
if (-not $allowedAgents) { $allowedAgents = @() }

if ($Agent -notin $allowedAgents) {
    Write-Host "[BLOCKED] Agente '$Agent' nao tem permissao na fase $Phase" -ForegroundColor Red
    Write-Host "   Agentes permitidos: $($allowedAgents -join ', ')" -ForegroundColor Yellow

    # Registrar no audit
    $auditScript = Join-Path (Join-Path $PSScriptRoot "..") "audit-logger.ps1"
    if (Test-Path $auditScript) {
        & $auditScript -Tool "permission" -File "phase-$Phase" -Agent $Agent -Phase $Phase -Result "BLOCKED" -Gate "permission" -Message "Agent not allowed in phase"
    }

    exit 1
}

# Verificar nivel de autonomia (usando rules.maxAutonomyLevel)
$autonomyLevel = "L2"  # Default
if ($permissions.rules -and $permissions.rules.PSObject.Properties) {
    $ruleConfig = $permissions.rules.PSObject.Properties | Where-Object { $_.Name -eq $Phase }
    if ($ruleConfig -and $ruleConfig.Value.maxAutonomyLevel) {
        $autonomyLevel = $ruleConfig.Value.maxAutonomyLevel
    }
}

# L3 requer aprovacao
if ($autonomyLevel -eq "L3") {
    Write-Host "[ASK] Fase $Phase requer aprovacao humana (L3)" -ForegroundColor Yellow
    Write-Host "   Autonomy level: $autonomyLevel" -ForegroundColor Yellow

    # Registrar no audit
    $auditScript = Join-Path (Join-Path $PSScriptRoot "..") "audit-logger.ps1"
    if (Test-Path $auditScript) {
        & $auditScript -Tool "permission" -File "phase-$Phase" -Agent $Agent -Phase $Phase -Result "ASK" -Gate "permission" -Message "L3 approval required"
    }

    # Por agora, permitir (em implementacao futura, pausar para aprovacao)
    Write-Host "   [PERMITIDO] Continuando..." -ForegroundColor Green
}

# Verificar se a fase requer aprovacao
if ($phaseData.requiredApprovals -and $phaseData.requiredApprovals -gt 0) {
    Write-Host "[ASK] Fase $Phase requer aprovacao ($($phaseData.requiredApprovals) aprovacoes)" -ForegroundColor Yellow

    # Registrar no audit
    $auditScript = Join-Path (Join-Path $PSScriptRoot "..") "audit-logger.ps1"
    if (Test-Path $auditScript) {
        & $auditScript -Tool "permission" -File "phase-$Phase" -Agent $Agent -Phase $Phase -Result "ASK" -Gate "permission" -Message "Approval required"
    }

    # Por agora, permitir
    Write-Host "   [PERMITIDO] Continuando..." -ForegroundColor Green
}

Write-Host "[PASS] Agente '$Agent' tem permissao na fase $Phase" -ForegroundColor Green
exit 0
