# KanzenAI scheduler — Windows installer
# Registers a Task Scheduler entry that runs the cross-platform node-cron
# scheduler at user logon, restarts it if it crashes, runs hidden.
#
# Run from PowerShell (NOT as admin — runs in user context):
#   cd C:\Users\User\Code\kanzenai
#   pwsh -ExecutionPolicy Bypass -File scripts\install-scheduler-windows.ps1
#
# Uninstall:
#   schtasks /Delete /TN "KanzenAI Scheduler" /F

$ErrorActionPreference = "Stop"

$TaskName    = "KanzenAI Scheduler"
$ProjectPath = (Get-Location).Path
$LogDir      = Join-Path $ProjectPath ".audit"
$LogFile     = Join-Path $LogDir "scheduler.log"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

# Sanity check — must be run from kanzenai project root
if (-not (Test-Path (Join-Path $ProjectPath "scripts\scheduler.ts"))) {
    Write-Error "Run this from the kanzenai project root. Cannot find scripts\scheduler.ts."
    exit 1
}
if (-not (Test-Path (Join-Path $ProjectPath ".env.local"))) {
    Write-Warning ".env.local not found at $ProjectPath\.env.local — copy your secrets there first."
}

# Resolve node + npm full paths (Task Scheduler doesn't inherit PATH the same way).
$npmPath = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmPath) {
    Write-Error "npm.cmd not found on PATH. Install Node.js LTS first: https://nodejs.org/"
    exit 1
}

# Build the command — run via cmd.exe so output redirection works.
$cmdLine = "/c cd /d `"$ProjectPath`" && `"$npmPath`" run scheduler >> `"$LogFile`" 2>&1"

# Delete any existing task with the same name
schtasks /Query /TN $TaskName 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Removing existing task..."
    schtasks /Delete /TN $TaskName /F | Out-Null
}

# Create the task
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $cmdLine -WorkingDirectory $ProjectPath
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Runs the KanzenAI cross-platform scheduler. Manages all bot crons in one node process." | Out-Null

Write-Host ""
Write-Host "✓ Installed Task Scheduler entry: $TaskName"
Write-Host "  Project:  $ProjectPath"
Write-Host "  Log:      $LogFile"
Write-Host "  Trigger:  At user logon (or run now: 'schtasks /Run /TN `"$TaskName`"')"
Write-Host ""
Write-Host "→ Start it now:    schtasks /Run /TN `"$TaskName`""
Write-Host "→ Check status:    schtasks /Query /TN `"$TaskName`" /V /FO LIST"
Write-Host "→ Tail the log:    Get-Content -Wait `"$LogFile`""
Write-Host "→ Stop running:    schtasks /End /TN `"$TaskName`""
Write-Host "→ Remove:          schtasks /Delete /TN `"$TaskName`" /F"
