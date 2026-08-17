#Requires -Version 5.1
<#
.SYNOPSIS
    behaviorOS Enforcement Layer - Orquestrador central de validação

.DESCRIPTION
    Valida gates (skill, tool, permission, state) antes de cada tool call.
    Chamado por agentes antes de executar qualquer ação de escrita/edição.

.PARAMETER Tool
    Ferramenta utilizada (write, edit, bash, read)

.PARAMETER File
    Caminho do arquivo alvo

.PARAMETER Agent
    Nome do agente (backend, frontend, database, qa, security, devops, compliance, architect, planner, orchestrator)

.PARAMETER Phase
    Fase atual (F0, F1, F2, F3, F4, F5, F6)

.PARAMETER Command
    Comando bash (quando Tool = bash)

.PARAMETER SkipGuards
    Pular validação de gates (apenas para emergências)

.EXAMPLE
    .\enforce.ps1 -Tool "write" -File "packages/db/prisma/schema.prisma" -Agent "database" -Phase "F1"

.EXAMPLE
    .\enforce.ps1 -Tool "bash" -File "" -Agent "devops" -Phase "F0" -Command "git commit -m 'feat: add schema'"
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("write", "edit", "bash", "read")]
    [string]$Tool,

    [Parameter(Mandatory=$false)]
    [string]$File = "",

    [Parameter(Mandatory=$true)]
    [ValidateSet("orchestrator", "architect", "planner", "backend", "frontend", "database", "qa", "security", "devops", "compliance")]
    [string]$Agent,

    [Parameter(Mandatory=$true)]
    [ValidateSet("F0", "F1", "F2", "F3", "F4", "F5", "F6")]
    [string]$Phase,

    [Parameter(Mandatory=$false)]
    [string]$Command = "",

    [switch]$SkipGuards
)

$ErrorActionPreference = "Stop"

# Encontrar raiz do projeto
$ProjectRoot = (Get-Location).Path
$ScriptsDir = $PSScriptRoot
$GuardsDir = Join-Path $ScriptsDir "guards"
$AuditScript = Join-Path $ScriptsDir "audit-logger.ps1"

# Variável de controle
$Script:ExitCode = 0
$Script:FailedGuards = @()

# Função para executar guard
function Invoke-Guard {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "══ Verificando $Name ══" -ForegroundColor Cyan

    try {
        $result = & $Command
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✓ ${Name}: PASS" -ForegroundColor Green
            return $true
        } else {
            Write-Host "   ✗ ${Name}: FAIL" -ForegroundColor Red
            $Script:FailedGuards += $Name
            $Script:ExitCode = 1
            return $false
        }
    } catch {
        Write-Host "   ✗ ${Name}: ERROR - $_" -ForegroundColor Red
        $Script:FailedGuards += $Name
        $Script:ExitCode = 1
        return $false
    }
}

# ─────────────────────────────────────────────────────────
# Cabeçalho
# ─────────────────────────────────────────────────────────

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "behaviorOS Enforcement Layer" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tool:   $Tool" -ForegroundColor Gray
Write-Host "File:   $(if ($File) { $File } else { '(nenhum)' })" -ForegroundColor Gray
Write-Host "Agent:  $Agent" -ForegroundColor Gray
Write-Host "Phase:  $Phase" -ForegroundColor Gray
if ($Command) {
    Write-Host "Command: $Command" -ForegroundColor Gray
}
Write-Host ""

# ─────────────────────────────────────────────────────────
# Verificar se guards estão habilitados
# ─────────────────────────────────────────────────────────

$GovernanceDir = Join-Path (Join-Path $ProjectRoot ".opencode") "governance"
$opencodeFile = Join-Path $ProjectRoot "opencode.json"

if (-not (Test-Path $opencodeFile)) {
    Write-Host "[WARN] opencode.json não encontrado - governance desabilitada" -ForegroundColor Yellow
    Write-Host "   Pulando validação de gates..." -ForegroundColor Yellow
    exit 0
}

# Verificar se governance está habilitado
try {
    $opencode = Get-Content $opencodeFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $opencode.governance -or -not $opencode.governance.enabled) {
        Write-Host "[WARN] Governance desabilitada no opencode.json" -ForegroundColor Yellow
        exit 0
    }
} catch {
    Write-Host "[WARN] Erro ao ler opencode.json: $_" -ForegroundColor Yellow
}

# ─────────────────────────────────────────────────────────
# Executar guards (se não SkipGuards)
# ─────────────────────────────────────────────────────────

if (-not $SkipGuards) {
    # 1. State Guard
    $stateGuard = Join-Path $GuardsDir "state-guard.ps1"
    if (Test-Path $stateGuard) {
        Invoke-Guard "State Guard" {
            & $stateGuard -Phase $Phase
        }
    }

    # 2. Permission Guard
    $permissionGuard = Join-Path $GuardsDir "permission-guard.ps1"
    if (Test-Path $permissionGuard) {
        Invoke-Guard "Permission Guard" {
            & $permissionGuard -Agent $Agent -Phase $Phase
        }
    }

    # 3. Skill Guard
    if ($File) {
        $skillGuard = Join-Path $GuardsDir "skill-guard.ps1"
        if (Test-Path $skillGuard) {
            Invoke-Guard "Skill Guard" {
                & $skillGuard -File $File -Phase $Phase
            }
        }
    }

    # 4. Tool Guard
    $toolGuard = Join-Path $GuardsDir "tool-guard.ps1"
    if (Test-Path $toolGuard) {
        Invoke-Guard "Tool Guard" {
            if ($Command) {
                & $toolGuard -Tool $Tool -File $File -Command $Command
            } else {
                & $toolGuard -Tool $Tool -File $File
            }
        }
    }
} else {
    Write-Host "[WARN] Guards pulados (SkipGuards)" -ForegroundColor Yellow
}

# ─────────────────────────────────────────────────────────
# Registrar resultado no audit
# ─────────────────────────────────────────────────────────

if (Test-Path $AuditScript) {
    $target = if ($Command) { $Command } elseif ($File) { $File } else { "none" }
    $result = if ($Script:ExitCode -eq 0) { "PASS" } else { "BLOCKED" }
    # FailedGuards holds display names ("State Guard", "Permission Guard", ...) but -Gate's
    # ValidateSet expects the short key ("state", "permission", ...) — strip the suffix.
    $gate = if ($Script:FailedGuards.Count -gt 0) { ($Script:FailedGuards[0] -replace ' Guard$', '').ToLower() } else { "enforce" }
    $message = if ($Script:FailedGuards.Count -gt 0) { "Failed: $($Script:FailedGuards -join ', ')" } else { "All gates passed" }
    
    & $AuditScript -Tool $Tool -File $target -Agent $Agent -Phase $Phase -Result $result -Gate $gate -Message $message
}

# ─────────────────────────────────────────────────────────
# Relatório final
# ─────────────────────────────────────────────────────────

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "RELATÓRIO DE ENFORCEMENT" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan

if ($Script:ExitCode -eq 0) {
    Write-Host "[OK] Todos os gates passaram - ação permitida" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Gates que falharam:" -ForegroundColor Red
    foreach ($guard in $Script:FailedGuards) {
        Write-Host "   - $guard" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Ação BLOQUEADA" -ForegroundColor Red
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan

exit $Script:ExitCode
