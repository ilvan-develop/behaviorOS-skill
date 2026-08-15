#Requires -Version 5.1
<#
.SYNOPSIS
    behaviorOS Audit Logger - Registra ações no audit trail

.DESCRIPTION
    Registra ações dos agentes no formato JSONL para consumo programático.
    Chamado por enforce.ps1 após cada validação de gate.

.PARAMETER Tool
    Ferramenta utilizada (write, edit, bash)

.PARAMETER File
    Caminho do arquivo alvo

.PARAMETER Agent
    Nome do agente (backend, frontend, database, etc.)

.PARAMETER Phase
    Fase atual (F0, F1, F2, F3, F4, F5, F6)

.PARAMETER Result
    Resultado da validação (PASS, BLOCKED, ASK)

.PARAMETER Gate
    Gate que validou (skill, tool, permission, state)

.PARAMETER Message
    Mensagem adicional (opcional)

.EXAMPLE
    .\audit-logger.ps1 -Tool "write" -File "schema.prisma" -Agent "database" -Phase "F1" -Result "PASS" -Gate "skill"
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("write", "edit", "bash", "read", "skill-load")]
    [string]$Tool,

    [Parameter(Mandatory=$true)]
    [string]$File,

    [Parameter(Mandatory=$true)]
    [string]$Agent,

    [Parameter(Mandatory=$true)]
    [ValidateSet("F0", "F1", "F2", "F3", "F4", "F5", "F6")]
    [string]$Phase,

    [Parameter(Mandatory=$true)]
    [ValidateSet("PASS", "BLOCKED", "ASK", "WARN")]
    [string]$Result,

    [Parameter(Mandatory=$false)]
    [ValidateSet("skill", "tool", "permission", "state", "enforce")]
    [string]$Gate = "enforce",

    [Parameter(Mandatory=$false)]
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"

# Encontrar raiz do projeto
$ProjectRoot = (Get-Location).Path
$GovernanceDir = Join-Path $ProjectRoot ".opencode" "governance"
$AuditDir = Join-Path $ProjectRoot ".opencode" "audit"
$LogFile = Join-Path $AuditDir "audit.log"
$JsonLogFile = Join-Path $AuditDir "audit.jsonl"

# Garantir que diretório de audit existe
if (-not (Test-Path $AuditDir)) {
    New-Item -ItemType Directory -Path $AuditDir -Force | Out-Null
}

# Construir entrada JSONL
$entry = @{
    timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    event = "tool_call"
    tool = $Tool
    file = $File
    agent = $Agent
    phase = $Phase
    gate = $Gate
    result = $Result
    message = $Message
    pid = $PID
}

# Converter para JSON
$json = $entry | ConvertTo-Json -Compress

# Escrever no log JSONL
Add-Content -Path $JsonLogFile -Value $json

# Escrever no log legível
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$logEntry = "$timestamp | $Phase | $Agent | $Tool | $File | $Gate | $Result"
if ($Message) { $logEntry += " | $Message" }
Add-Content -Path $LogFile -Value $logEntry

# Saída console
$color = switch ($Result) {
    "PASS"    { "Green" }
    "BLOCKED" { "Red" }
    "ASK"     { "Yellow" }
    "WARN"    { "Yellow" }
    default   { "Gray" }
}

Write-Host "[$Result] $Tool $File (agent=$Agent phase=$Phase gate=$Gate)" -ForegroundColor $color
