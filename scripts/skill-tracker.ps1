#Requires -Version 5.1
<#
.SYNOPSIS
    behaviorOS Skill Tracker - Rastreia skills carregadas na sessao

.DESCRIPTION
    Registra quais skills foram carregadas durante a sessao atual.
    Usado pelo skill-guard para verificar se uma skill foi carregada
    antes de executar codigo que depende dela.

.PARAMETER Skill
    Nome da skill sendo carregada (ex: "prisma", "nestjs", "react")

.PARAMETER Agent
    Nome do agente carregando a skill (ex: "database", "backend", "frontend")

.PARAMETER Phase
    Fase atual (F0, F1, F2, F3, F4, F5, F6)

.PARAMETER Action
    Acao: "load" (carregar skill), "unload" (descarregar), "list" (listar carregadas)

.PARAMETER Source
    Caminho da skill (opcional)

.EXAMPLE
    .\skill-tracker.ps1 -Skill "prisma" -Agent "database" -Phase "F1" -Action "load"

.EXAMPLE
    .\skill-tracker.ps1 -Action "list"
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$Skill = "",

    [Parameter(Mandatory=$false)]
    [string]$Agent = "",

    [Parameter(Mandatory=$false)]
    [string]$Phase = "",

    [Parameter(Mandatory=$true)]
    [ValidateSet("load", "unload", "list", "clear")]
    [string]$Action,

    [Parameter(Mandatory=$false)]
    [string]$Source = ""
)

$ErrorActionPreference = "Stop"

# Encontrar raiz do projeto
$ProjectRoot = (Get-Location).Path
$AuditDir = Join-Path (Join-Path $ProjectRoot ".opencode") "audit"
$TrackingFile = Join-Path $AuditDir "skills-loaded.json"
$SkillSelectionsLog = Join-Path $AuditDir "skill-selections.log"

# Garantir que diretorio de audit existe
if (-not (Test-Path $AuditDir)) {
    New-Item -ItemType Directory -Path $AuditDir -Force | Out-Null
}

# Funcao para ler skills rastreadas
function Read-TrackedSkills {
    if (-not (Test-Path $TrackingFile)) {
        return @{
            skills = @()
            lastUpdate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
    }
    return Get-Content $TrackingFile -Raw | ConvertFrom-Json
}

# Funcao para escrever skills rastreadas
function Write-TrackedSkills {
    param($Object)
    $Object | ConvertTo-Json -Depth 10 | Set-Content $TrackingFile
}

# Funcao para registrar no log de selecao
function Log-SkillSelection {
    param(
        [string]$SkillName,
        [string]$AgentName,
        [string]$PhaseName,
        [string]$SourcePath,
        [string]$Result
    )
    
    $entry = @{
        timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        event = "skill_load"
        skill = $SkillName
        agent = $AgentName
        phase = $PhaseName
        source = $SourcePath
        result = $Result
    }
    
    $json = $entry | ConvertTo-Json -Compress
    Add-Content -Path $SkillSelectionsLog -Value $json
}

# ========================================
# Acao: LIST - Listar skills carregadas
# ========================================

if ($Action -eq "list") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "SKILLS CARREGADAS NA SESSAO" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    $hasSkills = $false
    if (Test-Path $TrackingFile) {
        $json = Get-Content $TrackingFile -Raw
        if ($json -match '"name"\s*:\s*"([^"]+)"') {
            $matches_found = [regex]::Matches($json, '"name"\s*:\s*"([^"]+)"')
            $agent_matches = [regex]::Matches($json, '"agent"\s*:\s*"([^"]+)"')
            $phase_matches = [regex]::Matches($json, '"phase"\s*:\s*"([^"]+)"')
            $loaded_matches = [regex]::Matches($json, '"loadedAt"\s*:\s*"([^"]+)"')

            for ($i = 0; $i -lt $matches_found.Count; $i++) {
                $name = $matches_found[$i].Groups[1].Value
                $agent = if ($i -lt $agent_matches.Count) { $agent_matches[$i].Groups[1].Value } else { "" }
                $phase = if ($i -lt $phase_matches.Count) { $phase_matches[$i].Groups[1].Value } else { "" }
                $loaded = if ($i -lt $loaded_matches.Count) { $loaded_matches[$i].Groups[1].Value } else { "" }
                Write-Host "  * $name" -ForegroundColor Green
                Write-Host "    Agent: $agent" -ForegroundColor Gray
                Write-Host "    Phase: $phase" -ForegroundColor Gray
                Write-Host "    Loaded: $loaded" -ForegroundColor Gray
                Write-Host ""
                $hasSkills = $true
            }
        }
    }

    if (-not $hasSkills) {
        Write-Host "Nenhuma skill carregada" -ForegroundColor Yellow
    }

    Write-Host "========================================" -ForegroundColor Cyan
    exit 0
}

# ========================================
# Validacoes para acoes load/unload
# ========================================

if ($Action -in @("load", "unload")) {
    if (-not $Skill) {
        Write-Host "[ERROR] Parametro -Skill e obrigatorio para acao '$Action'" -ForegroundColor Red
        exit 1
    }
    if (-not $Agent) {
        Write-Host "[ERROR] Parametro -Agent e obrigatorio para acao '$Action'" -ForegroundColor Red
        exit 1
    }
    if (-not $Phase) {
        Write-Host "[ERROR] Parametro -Phase e obrigatorio para acao '$Action'" -ForegroundColor Red
        exit 1
    }
}

# ========================================
# Acao: LOAD - Carregar skill
# ========================================

if ($Action -eq "load") {
    $tracked = Read-TrackedSkills

    # Verificar se skill ja esta carregada
    $skillsArray = @($tracked.skills)
    $existing = $skillsArray | Where-Object { $_.name -eq $Skill }
    if ($existing) {
        Write-Host "[WARN] Skill '$Skill' ja esta carregada" -ForegroundColor Yellow
        Write-Host "   Agent: $($existing.agent)" -ForegroundColor Gray
        Write-Host "   Loaded: $($existing.loadedAt)" -ForegroundColor Gray
        
        # Atualizar agent e phase se mudou
        if ($existing.agent -ne $Agent -or $existing.phase -ne $Phase) {
            $existing.agent = $Agent
            $existing.phase = $Phase
            $existing.loadedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            Write-TrackedSkills $tracked
            Write-Host "   Atualizado para: agent=$Agent phase=$Phase" -ForegroundColor Green
        }
        
        exit 0
    }
    
    # Adicionar skill
    $newSkill = @{
        name = $Skill
        agent = $Agent
        phase = $Phase
        source = $Source
        loadedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }

    # Converter para array tipado (fix PowerShell 5.1 op_Addition bug)
    $skillsArray = @($tracked.skills)
    $skillsArray += $newSkill
    $tracked.skills = $skillsArray
    $tracked.lastUpdate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    
    Write-TrackedSkills $tracked
    
    # Registrar no log de selecao
    Log-SkillSelection -SkillName $Skill -AgentName $Agent -PhaseName $Phase -SourcePath $Source -Result "success"
    
    Write-Host "[OK] Skill '$Skill' carregada com sucesso" -ForegroundColor Green
    Write-Host "   Agent: $Agent" -ForegroundColor Gray
    Write-Host "   Phase: $Phase" -ForegroundColor Gray
    
    exit 0
}

# ========================================
# Acao: UNLOAD - Descarregar skill
# ========================================

if ($Action -eq "unload") {
    $tracked = Read-TrackedSkills

    # Verificar se skill esta carregada
    $skillsArray = @($tracked.skills)
    $existing = $skillsArray | Where-Object { $_.name -eq $Skill }
    if (-not $existing) {
        Write-Host "[WARN] Skill '$Skill' nao esta carregada" -ForegroundColor Yellow
        exit 0
    }

    # Remover skill
    $tracked.skills = @($skillsArray | Where-Object { $_.name -ne $Skill })
    $tracked.lastUpdate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    
    Write-TrackedSkills $tracked
    
    # Registrar no log
    Log-SkillSelection -SkillName $Skill -AgentName $Agent -PhaseName $Phase -SourcePath "" -Result "unloaded"
    
    Write-Host "[OK] Skill '$Skill' descarregada" -ForegroundColor Green
    
    exit 0
}

# ========================================
# Acao: CLEAR - Limpar todas as skills
# ========================================

if ($Action -eq "clear") {
    $tracked = @{
        skills = @()
        lastUpdate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }
    
    Write-TrackedSkills $tracked
    
    # Registrar no log
    Log-SkillSelection -SkillName "all" -AgentName "system" -PhaseName "" -SourcePath "" -Result "cleared"
    
    Write-Host "[OK] Todas as skills foram descarregadas" -ForegroundColor Green
    
    exit 0
}
