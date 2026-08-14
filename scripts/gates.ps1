#Requires -Version 5.1
<#
.SYNOPSIS
    behaviorOS Gates - Validacao de gates de qualidade

.DESCRIPTION
    Executa lint, typecheck, build e test na ordem correcta.
    Retorna exit code 0 se todos passarem, 1 se algum falhar.

.PARAMETER Phase
    Fase a validar (F0, F1, F2, F3, F4, F5, F6)

.PARAMETER SkipTests
    Pula testes (apenas lint, typecheck, build)

.EXAMPLE
    .\gates.ps1 -Phase F0
    .\gates.ps1 -Phase F1 -SkipTests
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("F0", "F1", "F2", "F3", "F4", "F5", "F6")]
    [string]$Phase,

    [switch]$SkipTests
)

$ErrorActionPreference = "Continue"
$Script:ExitCode = 0
$Script:FailedGates = @()

# Funcoes auxiliares
function Write-Gate {
    param([string]$Gate, [string]$Status, [string]$Details = "")
    $icon = switch ($Status) {
        "PASS" { "[OK]" }
        "FAIL" { "[FAIL]" }
        "SKIP" { "[SKIP]" }
        "RUN"  { "[RUN]" }
    }
    $color = switch ($Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "SKIP" { "Yellow" }
        "RUN"  { "Cyan" }
    }
    $message = "$icon $Gate"
    if ($Details) { $message += " - $Details" }
    Write-Host $message -ForegroundColor $color
}

function Test-Gate {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Gate $Name "RUN"

    try {
        $result = & $Command
        if ($LASTEXITCODE -eq 0) {
            Write-Gate $Name "PASS"
            return $true
        } else {
            Write-Gate $Name "FAIL" "Exit code: $LASTEXITCODE"
            $Script:FailedGates += $Name
            $Script:ExitCode = 1
            return $false
        }
    } catch {
        Write-Gate $Name "FAIL" $_.Exception.Message
        $Script:FailedGates += $Name
        $Script:ExitCode = 1
        return $false
    }
}

# Configuracao por fase
$PhaseConfig = @{
    "F0" = @{
        Name = "Fundacao"
        Gates = @("lint", "typecheck", "build", "test")
        RequiredCoverage = 0
    }
    "F1" = @{
        Name = "IAM + Tenants"
        Gates = @("lint", "typecheck", "build", "test", "integration")
        RequiredCoverage = 80
    }
    "F2" = @{
        Name = "Payments"
        Gates = @("lint", "typecheck", "build", "test", "integration", "e2e")
        RequiredCoverage = 80
    }
    "F3" = @{
        Name = "Billing"
        Gates = @("lint", "typecheck", "build", "test", "integration", "e2e")
        RequiredCoverage = 80
    }
    "F4" = @{
        Name = "Dev Platform"
        Gates = @("lint", "typecheck", "build", "test", "integration")
        RequiredCoverage = 80
    }
    "F5" = @{
        Name = "Audit + Compliance"
        Gates = @("lint", "typecheck", "build", "test", "integration", "e2e")
        RequiredCoverage = 85
    }
    "F6" = @{
        Name = "Endurecimento"
        Gates = @("lint", "typecheck", "build", "test", "integration", "e2e", "security")
        RequiredCoverage = 90
    }
}

$config = $PhaseConfig[$Phase]
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "behaviorOS Gates - Fase $Phase ($($config.Name))" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Executar gates na ordem correcta

# 1. Lint
if ($config.Gates -contains "lint") {
    Test-Gate "Lint" {
        if (Test-Path "package.json") {
            pnpm lint
        } else {
            Write-Host "package.json nao encontrado - a ignorar lint" -ForegroundColor Yellow
            return $true
        }
    }
}

# 2. Typecheck
if ($config.Gates -contains "typecheck") {
    Test-Gate "Typecheck" {
        if (Test-Path "package.json") {
            pnpm typecheck
        } else {
            Write-Host "package.json nao encontrado - a ignorar typecheck" -ForegroundColor Yellow
            return $true
        }
    }
}

# 3. Build
if ($config.Gates -contains "build") {
    Test-Gate "Build" {
        if (Test-Path "package.json") {
            pnpm build
        } else {
            Write-Host "package.json nao encontrado - a ignorar build" -ForegroundColor Yellow
            return $true
        }
    }
}

# 4. Testes unitarios
if ($config.Gates -contains "test" -and -not $SkipTests) {
    Test-Gate "Testes Unitarios" {
        if (Test-Path "package.json") {
            pnpm test:unit
        } else {
            Write-Host "package.json nao encontrado - a ignorar testes" -ForegroundColor Yellow
            return $true
        }
    }
}

# 5. Testes de integracao
if ($config.Gates -contains "integration" -and -not $SkipTests) {
    Test-Gate "Testes de Integracao" {
        if (Test-Path "package.json") {
            pnpm test:integration
        } else {
            Write-Host "package.json nao encontrado - a ignorar testes" -ForegroundColor Yellow
            return $true
        }
    }
}

# 6. Testes E2E
if ($config.Gates -contains "e2e" -and -not $SkipTests) {
    Test-Gate "Testes E2E" {
        if (Test-Path "package.json") {
            pnpm test:e2e
        } else {
            Write-Host "package.json nao encontrado - a ignorar testes" -ForegroundColor Yellow
            return $true
        }
    }
}

# 7. Security
if ($config.Gates -contains "security") {
    Test-Gate "Security" {
        # Verificar dependencias vulneraveis
        if (Test-Path "package.json") {
            pnpm audit
        } else {
            Write-Host "package.json nao encontrado - a ignorar security" -ForegroundColor Yellow
            return $true
        }
    }
}

# Relatorio final
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RELATORIO DE GATES - FASE $Phase" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($Script:ExitCode -eq 0) {
    Write-Host "[OK] Todos os gates passaram" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Gates que falharam:" -ForegroundColor Red
    foreach ($gate in $Script:FailedGates) {
        Write-Host "   - $gate" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Gates executados: $($config.Gates.Count)" -ForegroundColor Gray
Write-Host "Coverage minimo: $($config.RequiredCoverage)" -ForegroundColor Gray

exit $Script:ExitCode
