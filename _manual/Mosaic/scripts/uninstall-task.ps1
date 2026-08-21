<#
.SYNOPSIS
    Stops and removes the Windows Task Scheduler task installed by
    install-task.ps1.

.EXAMPLE
    .\scripts\uninstall-task.ps1
#>
param(
    [string]$TaskName = 'Mosaic'
)

$ErrorActionPreference = 'Stop'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Host "No scheduled task named '$TaskName' found - nothing to do."
    exit 0
}

if ($task.State -eq 'Running') {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
}
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false

Write-Host "Removed scheduled task '$TaskName'."
Write-Host "Note: this does not stop an already-running node.exe process started by the task; find it with 'Get-Process node' if needed."
