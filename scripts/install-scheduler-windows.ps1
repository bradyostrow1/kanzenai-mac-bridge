# KanzenAI scheduler - Windows installer (PS 5.1 safe, ASCII only)
# Registers a Task Scheduler entry that runs the cross-platform node-cron
# scheduler at user logon, restarts it if it crashes, runs hidden.

$ErrorActionPreference = "Stop"

$TaskName    = "KanzenAI Scheduler"
$ProjectPath = (Get-Location).Path
$LogDir      = Join-Path $ProjectPath ".audit"
$LogFile     = Join-Path $LogDir "scheduler.log"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

if (-not (Test-Path (Join-Path $ProjectPath "scripts\scheduler.ts"))) {
    Write-Error "Run this from the kanzenai project root. Cannot find scripts\scheduler.ts."
    exit 1
}
if (-not (Test-Path (Join-Path $ProjectPath ".env.local"))) {
    Write-Warning ".env.local not found at $ProjectPath\.env.local - copy your secrets there first."
}

$npmPath = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmPath) {
    Write-Error "npm.cmd not found on PATH. Install Node.js LTS first."
    exit 1
}

$cmdLine = "/c cd /d `"$ProjectPath`" && `"$npmPath`" run scheduler >> `"$LogFile`" 2>&1"

# Remove any existing task silently
try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
    Write-Host "Removed existing task."
} catch {
    # task didn't exist, no-op
}

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
Write-Host "Installed Task Scheduler entry: $TaskName"
Write-Host "  Project: $ProjectPath"
Write-Host "  Log:     $LogFile"
Write-Host "  Trigger: At user logon"
Write-Host ""
Write-Host "Start now:    schtasks /Run /TN `"$TaskName`""
Write-Host "Check status: schtasks /Query /TN `"$TaskName`" /V /FO LIST"
Write-Host "Tail log:     Get-Content -Wait `"$LogFile`""
Write-Host "Stop:         schtasks /End /TN `"$TaskName`""
Write-Host "Remove:       Unregister-ScheduledTask -TaskName `"$TaskName`" -Confirm:`$false"
