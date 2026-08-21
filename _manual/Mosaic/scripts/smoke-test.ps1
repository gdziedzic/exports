<#
.SYNOPSIS
    Starts Mosaic, exercises a handful of real routes against the committed
    sample data, then stops it. Intended as the final acceptance check
    before/after a deployment - see RELEASE_CHECKLIST.md.

.DESCRIPTION
    Runs against the *committed* sources.json/pages/ sample data
    (local-reference SQLite + the operations-overview configured page), so
    run `task seed` first if data/reference.db or data/warehouse.db don't
    exist yet. Exits non-zero (and prints every failure) if any check fails.

.EXAMPLE
    .\scripts\smoke-test.ps1
#>
param(
    [string]$WorkingDirectory = (Split-Path -Parent $PSScriptRoot),
    [int]$Port = 4933,
    [string]$NodePath = (Get-Command node -ErrorAction Stop).Source,
    [int]$StartupTimeoutSeconds = 20
)

$ErrorActionPreference = 'Stop'
$base = "http://127.0.0.1:$Port"
$failures = [System.Collections.Generic.List[string]]::new()
$stdoutLog = Join-Path $env:TEMP 'mosaic-smoke-stdout.log'
$stderrLog = Join-Path $env:TEMP 'mosaic-smoke-stderr.log'

function Test-Endpoint {
    param([string]$Path, [int]$ExpectedStatus = 200, [string]$Description)
    try {
        $response = Invoke-WebRequest -Uri "$base$Path" -UseBasicParsing -TimeoutSec 5 -SkipHttpErrorCheck
        if ($response.StatusCode -ne $ExpectedStatus) {
            $failures.Add("$Description : expected HTTP $ExpectedStatus, got $($response.StatusCode)")
        }
        else {
            Write-Host "  OK  $Description ($($response.StatusCode))"
        }
    }
    catch {
        $failures.Add("$Description : request failed - $($_.Exception.Message)")
    }
}

Write-Host "Starting Mosaic on port $Port (working directory: $WorkingDirectory) ..."
$env:MOSAIC_PORT = "$Port"
$proc = Start-Process -FilePath $NodePath -ArgumentList 'server.js' -WorkingDirectory $WorkingDirectory `
    -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog

try {
    $healthy = $false
    $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri "$base/health/live" -UseBasicParsing -TimeoutSec 2 -SkipHttpErrorCheck
            if ($r.StatusCode -eq 200) { $healthy = $true; break }
        }
        catch {
            Start-Sleep -Milliseconds 300
        }
    }
    if (-not $healthy) {
        throw "Mosaic did not respond to /health/live within $StartupTimeoutSeconds seconds. Check $stderrLog."
    }

    Test-Endpoint -Path '/health/live' -Description 'Liveness check'
    Test-Endpoint -Path '/health/ready' -Description 'Readiness check'
    Test-Endpoint -Path '/' -Description 'Home page'
    Test-Endpoint -Path '/sources/local-reference/main/customers' -Description 'Table browse (SQLite source)'
    Test-Endpoint -Path '/sources/local-reference/main/customers?export=csv' -Description 'CSV export'
    Test-Endpoint -Path '/pages/operations-overview' -Description 'Configured multi-source page'
    Test-Endpoint -Path '/does-not-exist' -ExpectedStatus 404 -Description '404 handling'
}
finally {
    Write-Host "Stopping Mosaic (pid $($proc.Id)) ..."
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

Write-Host ''
if ($failures.Count -gt 0) {
    Write-Host 'SMOKE TEST FAILED:' -ForegroundColor Red
    foreach ($f in $failures) { Write-Host "  - $f" -ForegroundColor Red }
    Write-Host "Server logs: $stdoutLog / $stderrLog"
    exit 1
}

Write-Host 'Smoke test passed.' -ForegroundColor Green
exit 0
