<#
.SYNOPSIS
    Registers a Windows Task Scheduler task that starts Mosaic at boot and
    restarts it if it exits unexpectedly.

.DESCRIPTION
    This is deliberately NOT a Win32 Service. A bare console Node.js process
    does not implement the Service Control Manager's handler API, so
    `sc.exe create` pointing at node.exe would not behave as a real service
    (no proper start/stop semantics, no service-manager visibility). Task
    Scheduler's "At startup" trigger plus its own restart-on-failure setting
    is the honest native alternative that needs no third-party wrapper
    (NSSM, etc.). See ARCHITECTURE.md's "Windows deployment model" section.

    Restart-on-failure has a real limit: Task Scheduler retries up to
    -RestartCount times, waiting -RestartIntervalMinutes between attempts,
    then gives up. This is not infinite self-healing - check on it.

.EXAMPLE
    # Run as Administrator. Registers the task to run as SYSTEM (no password needed).
    .\scripts\install-task.ps1

.EXAMPLE
    # Run as a specific service account instead of SYSTEM.
    .\scripts\install-task.ps1 -UserId 'CONTOSO\svc-mosaic' -Password (Read-Host -AsSecureString 'Password')
#>
param(
    [string]$TaskName = 'Mosaic',
    [string]$NodePath = (Get-Command node -ErrorAction Stop).Source,
    [string]$WorkingDirectory = (Split-Path -Parent $PSScriptRoot),
    [string]$UserId = 'SYSTEM',
    [securestring]$Password,
    [int]$RestartCount = 5,
    [int]$RestartIntervalMinutes = 1
)

$ErrorActionPreference = 'Stop'

$serverScript = Join-Path $WorkingDirectory 'server.js'
if (-not (Test-Path $serverScript)) {
    throw "server.js not found under '$WorkingDirectory'. Pass -WorkingDirectory explicitly if this script was moved out of the scripts/ folder."
}

$action = New-ScheduledTaskAction -Execute $NodePath -Argument 'server.js' -WorkingDirectory $WorkingDirectory
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
    -RestartCount $RestartCount `
    -RestartInterval (New-TimeSpan -Minutes $RestartIntervalMinutes) `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit ([TimeSpan]::Zero)
$description = "Mosaic data explorer - runs 'node server.js'. This is a Task Scheduler task, not a Win32 service - see ARCHITECTURE.md."

if ($UserId -eq 'SYSTEM') {
    $principal = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description $description -Force | Out-Null
}
elseif ($Password) {
    $cred = New-Object System.Management.Automation.PSCredential($UserId, $Password)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
        -User $cred.UserName -Password $cred.GetNetworkCredential().Password -RunLevel Limited -Description $description -Force | Out-Null
}
else {
    throw "Running as a non-SYSTEM account (-UserId '$UserId') requires -Password (a SecureString) so the task can run whether or not that user is logged in. Example: -Password (Read-Host -AsSecureString 'Password')"
}

Write-Host "Registered scheduled task '$TaskName' (runs 'node server.js' at startup, working directory '$WorkingDirectory', as '$UserId')."
Write-Host "Start it now without rebooting: Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Check status:                  Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Host "Remove it:                     .\scripts\uninstall-task.ps1 -TaskName '$TaskName'"
