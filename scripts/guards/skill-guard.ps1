#Requires -Version 5.1
<#
.SYNOPSIS
    behaviorOS Skill Guard - Valida skills antes de tool calls

.DESCRIPTION
    Verifica se a skill necessaria para o tipo de arquivo esta nas skills
    obrigatorias da fase atual. Le skill-gate.json para validacao.

.PARAMETER File
    Caminho do arquivo que esta sendo modificado

.PARAMETER Phase
    Fase atual (F0, F1, F2, F3, F4, F5, F6)

.EXAMPLE
    .\skill-guard.ps1 -File "packages/db/prisma/schema.prisma" -Phase "F1"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$File,

    [Parameter(Mandatory=$true)]
    [ValidateSet("F0", "F1", "F2", "F3", "F4", "F5", "F6")]
    [string]$Phase,

    [Parameter(Mandatory=$false)]
    [string]$SkillLoadLog = ""
)

$ErrorActionPreference = "Stop"

# Encontrar raiz do projeto
$ProjectRoot = (Get-Location).Path
$GovernanceDir = Join-Path (Join-Path $ProjectRoot ".opencode") "governance"
$SkillGateFile = Join-Path $GovernanceDir "skill-gate.json"

# Verificar se skill-gate.json existe
if (-not (Test-Path $SkillGateFile)) {
    Write-Host "[ERROR] skill-gate.json nao encontrado: $SkillGateFile" -ForegroundColor Red
    exit 1
}

# Ler skill-gate.json
try {
    $skillGate = Get-Content $SkillGateFile -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
    Write-Host "[ERROR] Erro ao ler skill-gate.json: $_" -ForegroundColor Red
    exit 1
}

# Obter skills obrigatorias para a fase
$phaseConfig = $skillGate.phases.$Phase
if (-not $phaseConfig) {
    Write-Host "[WARN] Fase $Phase nao encontrada no skill-gate.json" -ForegroundColor Yellow
    exit 0
}

$requiredSkills = $phaseConfig.required
if (-not $requiredSkills) { $requiredSkills = @() }

# Mapeamento de extensoes para skills necessarias
$skillMap = @{
    "*.prisma" = "prisma"
    "*.controller.ts" = "nestjs"
    "*.service.ts" = @("prisma", "nestjs")
    "*.module.ts" = "nestjs"
    "*.tsx" = @("react", "nextjs")
    "*.jsx" = "react"
    "*.contract.ts" = "orpc"
    "*.router.ts" = "orpc"
    "*.auth.ts" = "better-auth"
    "*.test.ts" = "vitest"
    "*.test.tsx" = "testing-library"
    "*.spec.ts" = "vitest"
    "*.e2e.ts" = "playwright"
}

# Obter extensao do arquivo
$extension = [System.IO.Path]::GetExtension($File)
$fileExtension = "*$extension"

# Verificar se a extensao tem uma skill mapeada
$requiredSkill = $skillMap.$fileExtension

# Se nao encontrou pela extensao, verificar pelo nome do arquivo
if (-not $requiredSkill) {
    $fileName = [System.IO.Path]::GetFileName($File)

    if ($fileName -match "\.prisma$") {
        $requiredSkill = "prisma"
    } elseif ($fileName -match "\.controller\.") {
        $requiredSkill = "nestjs"
    } elseif ($fileName -match "\.service\.") {
        $requiredSkill = @("prisma", "nestjs")
    } elseif ($fileName -match "\.contract\.") {
        $requiredSkill = "orpc"
    } elseif ($fileName -match "\.auth\.") {
        $requiredSkill = "better-auth"
    }
}

# Se nao ha skill necessaria, permitir
if (-not $requiredSkill) {
    Write-Host "[PASS] Nenhuma skill especifica necessaria para $File" -ForegroundColor Green
    exit 0
}

# Converter para array se necessario
if ($requiredSkill -is [string]) {
    $requiredSkill = @($requiredSkill)
}

# Verificar se todas as skills necessarias estao nas obrigatorias
$missingSkills = @()
foreach ($skill in $requiredSkill) {
    if ($skill -notin $requiredSkills) {
        $missingSkills += $skill
    }
}

# Sempre verificar context7-mcp para qualquer modificacao de arquivo
# Regra 18: Agent Loop obrigatorio - context7 deve estar carregado
$skillsLoadedFile = Join-Path (Join-Path $ProjectRoot ".opencode") "audit\skills-loaded.json"
if (Test-Path $skillsLoadedFile) {
    try {
        $skillsLoaded = Get-Content $skillsLoadedFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $loadedNames = @()
        $skillsArray = if ($skillsLoaded.skills) { $skillsLoaded.skills } else { $skillsLoaded }
        foreach ($entry in $skillsArray) {
            if ($entry.name) { $loadedNames += $entry.name }
        }
        if ("context7-mcp" -notin $loadedNames) {
            $missingSkills += "context7-mcp"
            Write-Host "[BLOCKED] context7-mcp nao esta no skills-loaded.json" -ForegroundColor Red
            Write-Host "   Execute: .\scripts\skill-tracker.ps1 -Skill 'context7-mcp' -Agent '<agent>' -Phase '$Phase' -Action 'load'" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[WARN] Erro ao ler skills-loaded.json: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "[BLOCKED] skills-loaded.json nao encontrado - context7-mcp obrigatorio" -ForegroundColor Red
    Write-Host "   Execute: .\scripts\skill-tracker.ps1 -Skill 'context7-mcp' -Agent '<agent>' -Phase '$Phase' -Action 'load'" -ForegroundColor Yellow
    $missingSkills += "context7-mcp"
}

if ($missingSkills.Count -gt 0) {
    $missingList = $missingSkills -join ", "
    Write-Host "[BLOCKED] Skills obrigatorias nao encontradas para $File" -ForegroundColor Red
    Write-Host "   Skills necessarias: $missingList" -ForegroundColor Red
    Write-Host "   Skills obrigatorias para ${Phase}: $($requiredSkills -join ', ')" -ForegroundColor Yellow

    # Registrar no audit
    $auditScript = Join-Path (Join-Path $PSScriptRoot "..") "audit-logger.ps1"
    if (Test-Path $auditScript) {
        & $auditScript -Tool "write" -File $File -Agent "unknown" -Phase $Phase -Result "BLOCKED" -Gate "skill" -Message "Missing skills: $missingList"
    }

    exit 1
}

Write-Host "[PASS] Skills validadas para $File (fase $Phase)" -ForegroundColor Green
exit 0
