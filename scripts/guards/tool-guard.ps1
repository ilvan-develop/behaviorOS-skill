#Requires -Version 5.1
<#
.SYNOPSIS
    behaviorOS Tool Guard - Valida tool patterns antes de execução

.DESCRIPTION
    Verifica se a ferramenta pode ser usada no arquivo especificado.
    Lê tool-gate.json para validação de patterns e ações.

.PARAMETER Tool
    Ferramenta utilizada (write, edit, bash, read)

.PARAMETER File
    Caminho do arquivo alvo

.PARAMETER Command
    Comando bash (quando Tool = bash)

.EXAMPLE
    .\tool-guard.ps1 -Tool "write" -File "packages/db/prisma/schema.prisma"

.EXAMPLE
    .\tool-guard.ps1 -Tool "bash" -File "" -Command "git push origin main"
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("write", "edit", "bash", "read")]
    [string]$Tool,

    [Parameter(Mandatory=$false)]
    [string]$File = "",

    [Parameter(Mandatory=$false)]
    [string]$Command = ""
)

$ErrorActionPreference = "Stop"

# Encontrar raiz do projeto
$ProjectRoot = (Get-Location).Path
$GovernanceDir = Join-Path $ProjectRoot ".opencode" "governance"
$ToolGateFile = Join-Path $GovernanceDir "tool-gate.json"

# Verificar se tool-gate.json existe
if (-not (Test-Path $ToolGateFile)) {
    Write-Host "[WARN] tool-gate.json não encontrado - permitindo ação" -ForegroundColor Yellow
    exit 0
}

# Ler tool-gate.json
try {
    $toolGate = Get-Content $ToolGateFile -Raw | ConvertFrom-Json
} catch {
    Write-Host "[ERROR] Erro ao ler tool-gate.json: $_" -ForegroundColor Red
    exit 1
}

# Verificar se gates estão habilitados
if (-not $toolGate.enabled) {
    Write-Host "[PASS] Tool gates desabilitados" -ForegroundColor Green
    exit 0
}

# Verificar regras específicas
foreach ($rule in $toolGate.rules) {
    $match = $false
    
    # Verificar se a ferramenta corresponde
    if ($Tool -eq $rule.tool) {
        # Verificar pattern
        if ($rule.pattern) {
            if ($Tool -eq "bash" -and $Command) {
                $match = $Command -like $rule.pattern
            } elseif ($File) {
                $match = $File -like $rule.pattern
            }
        } else {
            $match = $true
        }
    }
    
    if ($match) {
        switch ($rule.action) {
            "deny" {
                Write-Host "[BLOCKED] Acao negada pela regra: $($rule.id)" -ForegroundColor Red
                Write-Host "   Tool: $Tool" -ForegroundColor Red
                Write-Host "   Pattern: $($rule.pattern)" -ForegroundColor Red

                # Registrar no audit
                $auditScript = Join-Path (Join-Path $PSScriptRoot "..") "audit-logger.ps1"
                if (Test-Path $auditScript) {
                    $target = if ($Command) { $Command } else { $File }
                    & $auditScript -Tool $Tool -File $target -Agent "unknown" -Phase "unknown" -Result "BLOCKED" -Gate "tool" -Message "Rule: $($rule.id)"
                }

                exit 1
            }
            "block" {
                # "block" e equivalente a "deny"
                Write-Host "[BLOCKED] Acao bloqueada pela regra: $($rule.id)" -ForegroundColor Red
                Write-Host "   Tool: $Tool" -ForegroundColor Red
                Write-Host "   Pattern: $($rule.pattern)" -ForegroundColor Red

                # Registrar no audit
                $auditScript = Join-Path (Join-Path $PSScriptRoot "..") "audit-logger.ps1"
                if (Test-Path $auditScript) {
                    $target = if ($Command) { $Command } else { $File }
                    & $auditScript -Tool $Tool -File $target -Agent "unknown" -Phase "unknown" -Result "BLOCKED" -Gate "tool" -Message "Rule: $($rule.id)"
                }

                exit 1
            }
            "ask" {
                Write-Host "[ASK] Requer aprovação para esta ação" -ForegroundColor Yellow
                Write-Host "   Rule: $($rule.id)" -ForegroundColor Yellow
                Write-Host "   Tool: $Tool" -ForegroundColor Yellow
                
                # Verificar se há checks específicos
                if ($rule.checks) {
                    Write-Host "   Executando checks de qualidade..." -ForegroundColor Cyan
                    foreach ($check in $rule.checks) {
                        if ($check.required) {
                            Write-Host "   - $($check.name): " -ForegroundColor Gray -NoNewline
                            try {
                                $result = Invoke-Expression $check.command 2>&1
                                if ($LASTEXITCODE -eq 0) {
                                    Write-Host "OK" -ForegroundColor Green
                                } else {
                                    Write-Host "FALHOU" -ForegroundColor Red
                                    Write-Host "     Comando: $($check.command)" -ForegroundColor Red
                                    exit 1
                                }
                            } catch {
                                Write-Host "ERRO" -ForegroundColor Red
                                exit 1
                            }
                        }
                    }
                }
                
                # Registrar ask no audit
                $auditScript = Join-Path $PSScriptRoot ".." "audit-logger.ps1"
                if (Test-Path $auditScript) {
                    $target = if ($Command) { $Command } else { $File }
                    & $auditScript -Tool $Tool -File $target -Agent "unknown" -Phase "unknown" -Result "ASK" -Gate "tool" -Message "Rule: $($rule.id)"
                }
                
                # Por agora, permitir (em implementação futura, pausar para aprovação)
                Write-Host "   [PERMITIDO] Continuando..." -ForegroundColor Green
            }
            "allow" {
                Write-Host "[PASS] Ação permitida pela regra: $($rule.id)" -ForegroundColor Green
                exit 0
            }
        }
    }
}

# Verificar regras globais - forbiddenPatterns
if ($toolGate.globalRules -and $toolGate.globalRules.forbiddenPatterns) {
    foreach ($forbidden in $toolGate.globalRules.forbiddenPatterns) {
        if ($File -and (Test-Path $File)) {
            $content = Get-Content $File -Raw -ErrorAction SilentlyContinue
            if ($content -and $content -match $forbidden.pattern) {
                Write-Host "[BLOCKED] Padrão proibido encontrado: $($forbidden.message)" -ForegroundColor Red
                Write-Host "   Pattern: $($forbidden.pattern)" -ForegroundColor Red
                
                # Registrar no audit
                $auditScript = Join-Path $PSScriptRoot ".." "audit-logger.ps1"
                if (Test-Path $auditScript) {
                    & $auditScript -Tool $Tool -File $File -Agent "unknown" -Phase "unknown" -Result "BLOCKED" -Gate "tool" -Message "Forbidden pattern: $($forbidden.message)"
                }
                
                exit 1
            }
        }
    }
}

# Verificar regras globais - requiredPatterns
if ($toolGate.globalRules -and $toolGate.globalRules.requiredPatterns) {
    foreach ($required in $toolGate.globalRules.requiredPatterns) {
        if ($File -and $File -like $required.filePattern -and (Test-Path $File)) {
            $content = Get-Content $File -Raw -ErrorAction SilentlyContinue
            if ($content -and $content -notmatch $required.pattern) {
                Write-Host "[WARN] Padrão obrigatório não encontrado: $($required.message)" -ForegroundColor Yellow
                Write-Host "   Pattern: $($required.pattern)" -ForegroundColor Yellow
                Write-Host "   File pattern: $($required.filePattern)" -ForegroundColor Yellow
                
                # Registrar warn no audit
                $auditScript = Join-Path $PSScriptRoot ".." "audit-logger.ps1"
                if (Test-Path $auditScript) {
                    & $auditScript -Tool $Tool -File $File -Agent "unknown" -Phase "unknown" -Result "WARN" -Gate "tool" -Message "Missing pattern: $($required.message)"
                }
                
                # Não bloquear, apenas avisar
            }
        }
    }
}

# Se nenhuma regra correspondeu, permitir
Write-Host "[PASS] Nenhuma regra restritiva encontrada para $Tool" -ForegroundColor Green
exit 0
