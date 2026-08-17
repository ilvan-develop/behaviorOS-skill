#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Log skill selection events to audit trail.

.DESCRIPTION
    Records skill selection events in JSONL format for audit trail.
    Called by agents before executing tasks to log which skill was loaded.

.PARAMETER Skill
    Name of the skill being loaded (e.g., "nestjs", "prisma", "react")

.PARAMETER Agent
    Name of the agent loading the skill (e.g., "backend", "frontend", "qa")

.PARAMETER Phase
    Current phase (e.g., "F0", "F1", "F2")

.PARAMETER Source
    Path to the skill directory (e.g., ".opencode/skills/nestjs")

.PARAMETER Result
    Result of the skill load: "success", "not_found", "error"

.EXAMPLE
    .\log-skill-selection.ps1 -Skill "nestjs" -Agent "backend" -Phase "F2" -Source ".opencode/skills/nestjs" -Result "success"

.EXAMPLE
    .\log-skill-selection.ps1 -Skill "unknown-skill" -Agent "frontend" -Phase "F1" -Source "" -Result "not_found"
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$Skill,

    [Parameter(Mandatory=$true)]
    [string]$Agent,

    [Parameter(Mandatory=$false)]
    [string]$Phase = "unknown",

    [Parameter(Mandatory=$false)]
    [string]$Source = "",

    [Parameter(Mandatory=$false)]
    [ValidateSet("success", "not_found", "error")]
    [string]$Result = "success"
)

$ErrorActionPreference = "Stop"

# Configuration - find project root
$ProjectRoot = (Get-Location).Path
$AuditDir = Join-Path (Join-Path $ProjectRoot ".opencode") "audit"
$LogFile = Join-Path $AuditDir "skill-selections.log"

# Ensure audit directory exists
if (-not (Test-Path $AuditDir)) {
    New-Item -ItemType Directory -Path $AuditDir -Force | Out-Null
}

# Build JSONL entry
$entry = @{
    timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    event = "skill_load"
    skill = $Skill
    agent = $Agent
    phase = $Phase
    source = $Source
    result = $Result
}

# Convert to JSON and append (avoid Add-Content -Encoding UTF8's BOM-on-create, which would
# break Node's JSON.parse on the first line — see scripts/oage-metrics.mjs)
$json = $entry | ConvertTo-Json -Compress
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
if (-not (Test-Path $LogFile)) {
    [System.IO.File]::WriteAllText($LogFile, "$json`n", $utf8NoBom)
} else {
    [System.IO.File]::AppendAllText($LogFile, "$json`n", $utf8NoBom)
}

# Console output for visibility
Write-Host "[SKILL-LOAD] skill=$Skill agent=$Agent phase=$Phase result=$Result" -ForegroundColor Cyan
